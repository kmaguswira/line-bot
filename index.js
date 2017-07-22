
const bodyParser = require('body-parser');
const express = require('express');
const fs = require('fs');
const mcache = require('memory-cache');
const mongoose = require("mongoose");
const morgan  = require('morgan');
const line = require('node-line-bot-api');
const request = require('request');
const scheduler = require('node-schedule');
const fsPath = require('fs-path');
const path = require('path');

const eat = require('./controller/eat');
const eventbrite = require('./controller/event');
const helper = require('./controller/helper');
const menu = require('./controller/menu');
const place = require('./controller/place');
const travelPal = require('./controller/travel-pal');
const weather = require('./controller/weather');
const imgur = require('./controller/imgur');
const feedback = require('./controller/feedback');
const hotel = require('./controller/hotel');

const Chat = require('./model/chat');
const Subscribes = require('./model/subscribes');
const Message = require('./model/message');

const constant = require('./constant');
const key = require('./key');
const replyMessage = require('./replyMessage');
const app = express();

const dbUser = 'xploria-bot-db.documents.azure.com';
const dbPass = 'W27cZH5QC2dd9jV4XfKNvnOPMLMJeSSS1pYJfpAoXxDYFQwJ4lKsUs12BHmJYmAXCWBc8jSaIccpB580EsyTjA==';
const dbName = 'xploria-bot-db';

app.use('/static', express.static('public'));
app.use(morgan('combined'));
app.use(bodyParser.json({
  verify (req, res, buf) {
    req.rawBody = buf;
  }
}));

mongoose.connect(`mongodb://${dbName}:${dbPass}@${dbUser}:10250/admin/?ssl=true`, (err, res) => {
  if(err) {
    helper.errorHandler(err, 'error connecting to db.');
  } else {
    // Chat.collection.drop();
    // Message.collection.drop();
    console.log('Connected to db');
  }
});
line.init({
  accessToken: key.line.at,
  channelSecret: key.line.cs
});

//start weather scheduler
const startSchedule = scheduler.scheduleJob('0 * * * *', () => {
  sendWeatherForecastToSubscribers();
});

const sendWeatherForecastToSubscribers = () => {
  let dateObj = new Date();
  const sendWeather = weather.getSubscribers((30 - dateObj.getHours()) * 3600);
  //const sendWeather = weather.getSubscribers(28800);
  let promises = [];
  sendWeather.then((result) => {
    result.map((x)=>{
      let arr = [];
      x.subscribers.map((y)=>{
        arr.push(y.user_id);
      });
      promises.push(weather.sendWeatherToSubscriber(arr, x.location));
    });

    Promise.all(promises).then((x)=>{
      console.log('success');
    }).catch((err) => {
      console.log(err);
    });

  });
};

let updateCachePromise = (key, value, param)=>{
  return new Promise((resolve, reject)=>{
    let obj = mcache.get(key);
    if(param==="location")
      obj.location = value;
    else if(param==="latlong")
      obj.latlong = value;
    else
      obj.type = value;

    if(mcache.del(key)){
      mcache.put(key, obj, 60*1000);
      resolve(obj);
    }else{
      reject('err');
    }
  });
};

app.post('/linebotmain/', line.validator.validateSignature(),
  (req, res, next) => {
    const promises = req.body.events.map(event => {
      console.log('#########EVENT####################', event);
      let displayName = '';
      switch (event.type){
        case 'message':
          if(event.source.type === 'user'){
            let cachedBody = mcache.get(event.source.userId);
            eventMessage(event, cachedBody, displayName, event.source.userId);
          }
          else if(event.source.type === 'group' || event.source.type === 'room'){
            let id = event.source.type === 'group'?event.source.groupId:event.source.roomId;
            console.log('################ID#############',id);
            let cachedBody = mcache.get(id);
            eventMessage(event, cachedBody, displayName, id);
          }
          break;
        case 'postback':
          if(event.postback.data.includes('ref=place'))
            postbackPlace(event);
          else if(event.postback.data.includes('ref=event'))
            postbackEvent(event);
          else if(event.postback.data.includes('ref=restaurant'))
            postbackRestaurant(event);
          else if(event.postback.data.includes('ref=weather'))
            postbackWeather(event);
          else if(event.postback.data.includes('ref=travelPal'))
            postbackTravelPal(event);
          break;
        case 'follow':
          followEvent(event);
          break;
        case 'unfollow':
          unfollowEvent(event);
          break;
        case 'join':
          joinEvent(event);
          break;
        case 'leave':
          leaveEvent(event);
          break;
        default:
          break;
      }
    });

    //run promises
    Promise
      .all(promises)
      .then(() => res.json({success: true}));
});

app.get('/local/', (req, res)=>{
  //res.json({test:'test'});
  //*
  let result = place.searchPlaceByText('sanur');
  result.then(x=>{
    res.json(x);
  });
});

app.get('/', (req, res)=>{
  res.sendFile(path.join(__dirname+'/view/index.html'));
});

app.get('/forever', (req, res)=>{
  let dateObj = new Date();

  res.json({status:"ok", time:dateObj.getHours()});
});

const eventMessage = (event, cachedBody, displayName, id) => {
  console.log("#########CACHE########", cachedBody);
  if(!cachedBody) {
    const command = constant.commandCache();
    if(event.source.type==='user'){
      commandUser(event, cachedBody, displayName, id, command);
    }else{
      commandGroup(event, cachedBody, displayName, id, command);
    }
    return;
  }

  if(event.message.type==='text'&&constant.commandUser.indexOf(event.message.text.toLowerCase())!==-1){
    if(event.source.type==='user'){
      commandUser(event, cachedBody, displayName, id, constant.commandCache());
    }else{
      commandGroup(event, cachedBody, displayName, id, constant.commandCache());
    }
    return;
  }

  switch (cachedBody.name) {
    case '#lokasi':
      getLandmark(cachedBody, event, id);
      break;
    case '#hotel':
      getHotel(cachedBody, event, id);
      break;
    case '#event':
      getEvents(cachedBody, event, id);
      break;
    case '#yuk-jalan':
      getTravelPal(cachedBody, event, id);
      break;
    case '#feedback':
      sendFeedback(cachedBody, event, id);
      break;
    case '#cuaca':
      getWeather(cachedBody, event, id);
      break;
    case '#kuliner':
      getRestaurant(cachedBody, event, id);
      break;
    case 'distanceToPlace':
      getDistance(cachedBody, event, id);
      break;
    default:
      console.log('command not identified');
  }
};

const processSentence = (sentence) => {
  const words = sentence.toLowerCase().replace(/#(\S*)/g,' ').replace(/[^\w\s]/g,' ').split(' ');
  const commands = constant.commandSentence();
  let selectedCommand;
  let commandFound;

  commands.some( (e,i) => {
      commandFound = words.some( (wordsElem,wordsIndex) => {
        selectedCommand = (e.word === wordsElem) ? e.command:null;
        return selectedCommand;
      })
      return commandFound;
  });

  return selectedCommand;
}

const getLandmark = (cachedBody, event, id) => {
  if(cachedBody.location===null&&cachedBody.latlong===null&&event.message.type==='text'){

    console.log("##########TEST##########");
    let updateCache = updateCachePromise(id, event.message.text, 'location');
    updateCache.then((result)=>{
      let searchPlace = place.searchPlaceByText(event.message.text);
      searchPlace.then((data)=>{
        mcache.del(id);
        return helper.replyMessage(event.replyToken, data).catch((er)=>{console.log(err);});
      }).catch((err)=>{
        //check
        return helper.replyMessage(event.replyToken, err);
      });
    }).catch((err)=>{
      helper.errorHandler(err, 'update cache on getLandmark', event);
    });
  } else {
    return helper.wrongInputHandler(event);
  }
};

const getEvents = (cachedBody, event, id) => {
  if(cachedBody.latlong===null&&event.message.type==='location'){
    let getEventbrite = eventbrite.getCategories(event.message.latitude, event.message.longitude);
    getEventbrite.then((data)=>{
      mcache.del(id);
        return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      helper.errorHandler(err, 'getCategories promise on getEvents', event);
    });
  }else{
    return helper.wrongInputHandler(event);
  }
};

const getDistance = (cachedBody, event, id) => {
  if(cachedBody.latCurrent===null&&cachedBody.longCurrent===null&&event.message.type==='location'){
    let countDistance = place.calculateDistance(cachedBody.latPlace, cachedBody.longPlace, event.message.latitude, event.message.longitude);
    countDistance.then((data)=>{
      mcache.del(id);

      return helper.generateMessage(event.replyToken, data.reply, data.d);
    });
  }else{
    return helper.wrongInputHandler(event);
  }
};

const getRestaurant = (cachedBody, event, id) => {
  if(cachedBody.latlong===null&&event.message.type==='location'){
    let restaurants = eat.searchRestaurant(event.message.latitude, event.message.longitude);
    restaurants.then((data)=>{
      mcache.del(id);
      if(data.type==='template'){
        return helper.replyMessage(event.replyToken, [helper.buildText('Kak ini kuliner didekat sana, bisa pilih menu yang tersedia untuk lebih detail:)'), data]);
      }else{
        return helper.replyMessage(event.replyToken, [data]);
      }
    }).catch((err)=>{
      helper.errorHandler(err, 'searchRestaurant promise on getRestaurant', event);
    });
  }else{
    return helper.wrongInputHandler(event);
  }
};

const sendFeedback = (cachedBody, event, id) =>{
  let send = feedback.sendFeedback(event.message.text);
  send.then((data)=>{
    mcache.del(id);
    return helper.replyMessage(event.replyToken, data);
  }).catch((err)=>{
    helper.errorHandler(err, 'sendFeedback', event);
  });
};

const getWeather = (cachedBody, event, id) => {

  if(cachedBody.latlong!==null || event.message.type!=='location') {
    return helper.wrongInputHandler(event);
  }

  const updateCache = updateCachePromise(id, event.message.text, 'location');

  updateCache.then((result)=>{
    const getWeather = weather.getWeatherForecast(event.message.latitude, event.message.longitude);
    getWeather.then((data)=>{
      mcache.del(id);
      return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      //check
      return helper.replyMessage(event.replyToken, err);
    });
  }).catch((err)=>{
    helper.errorHandler(err, 'update cache on getWeather', event);
  });
};

const getHotel = (cachedBody, event, id) => {
  console.log('getHotel',cachedBody);
  if(event.message.type!=='text') {
    return helper.wrongInputHandler(event);
  }

  if(cachedBody.location===null&&cachedBody.latlong===null&&event.message.type==='text'){
    const updateCache = updateCachePromise(id, event.message.text, 'location');

    const tempMessage = replyMessage.askingDateForHotel[Math.floor(Math.random() * replyMessage.askingDateForHotel.length)].replace(" ###", "");
    const reply = `${tempMessage} ${replyMessage.hotelDateFormatExample[0]}`;

    return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
  }

  if(cachedBody.location!==null&&cachedBody.latlong===null&&event.message.type==='text') {
    console.log('Hotel Step 2',event.message);
    //parse text
    const tempDates = event.message.text.replace(" ", "");
    const dates = tempDates.split(':');
    let checkIn = dates[0].split('/');
    let checkOut = dates[1].split('/');
    checkIn = new Date(checkIn[2],checkIn[1]-1,checkIn[0]);
    checkOut = new Date(checkOut[2],checkOut[1]-1,checkOut[0]);
    console.log('date checkin',checkIn,checkOut);
    const getHotel = hotel.searchHotels(cachedBody.location,checkIn,checkOut);
    getHotel.then((result) => {
      mcache.del(id);
      console.log(result);
      return helper.replyMessage(event.replyToken, result);
    }).catch((err) => {
      return helper.replyMessage(event.replyToken, err);
    });
  }

};

let getTravelPal = (cachedBody, event, id) => {
  if(cachedBody.latlong === null && event.message.type==='location'){
    let promises = travelPal.checkLocation(event, id);
    promises.then((reply)=>{
      console.log("#####REPLY######",reply);
      mcache.del(id);
      console.log('################CACHE##########', mcache.get(id));
      if(reply.status === '200'){
        let profile = line.client.getProfile(reply.id);
        profile.then((detail)=>{
          console.log('#####DETAIL###########', detail);
          let saveProfilePic = downloadImage(detail.pictureUrl, reply.id);
          saveProfilePic.then((pic)=>{
            let profileUser1 = helper.buildTemplate('buttons', `${detail.displayName} profile`, detail.pictureUrl===null?pic:`https://xploria-bot.azurewebsites.net/static/user/${id}.jpg`, detail.displayName,detail.statusMessage === null ? 'Tidak ada status' : detail.statusMessage);
            profileUser1.pushAction(helper.createAction('postback', 'Tinggalkan teman', `ref=travelPal&action=leavePal&pal=${reply.id}`));
            let notify = helper.pushMessage(reply.pal, [helper.buildText('Ini kak teman baru kamu, silahkan dimulai obrolannya :)'), profileUser1.getTemplate]);
            notify.then((status)=>{
              let profilePal = line.client.getProfile(reply.pal);
              profilePal.then((detailPal)=>{
                console.log('#####DETAIL2###########', detailPal);
                let saveProfilePicPal = downloadImage(detailPal.pictureUrl, reply.pal);
                saveProfilePicPal.then((picPal)=>{
                  let profileUser2 = helper.buildTemplate('buttons', `${detailPal.displayName} profile`, detailPal.pictureUrl===null?picPal:`https://xploria-bot.azurewebsites.net/static/user/${reply.pal}.jpg`, detailPal.displayName, detail.statusMessage === null ? 'Tidak ada status' : detail.statusMessage);
                  profileUser2.pushAction(helper.createAction('postback', 'Tinggalkan teman', `ref=travelPal&action=leavePal&pal=${reply.pal}`));
                  return helper.pushMessage(reply.id, [helper.buildText('Ini kak teman baru kamu, silahkan dimulai obrolannya :)'), profileUser2.getTemplate]);
                }).catch((err)=>{
                  helper.errorHandler(err, 'saveProfilePicPal promise on getTravelPal', event);
                });
              });
            }).catch((err)=>{
              helper.errorHandler(err, 'notify promise on getTravelPal', event);
            });
          }).catch((err)=>{
            helper.errorHandler(err, 'saveProfilePic promise on getTravelPal', event);
          });
        });
      }
      else{
        return helper.pushMessage(reply.id, [helper.buildText('Yah sorry kak, untuk saat ini teman jalan belum ditemukan.')]);
      }
    }).catch((err)=>{
      mcache.del(id);
      helper.errorHandler(err, 'promises promise on getTravelPal', event);
    });
  }else if(cachedBody.latlong !== null && ['location','text','image'].indexOf(event.message.type)!==-1){
    return helper.replyMessage(event.replyToken, [helper.buildText("Sedang mencari . . .")]);
  }
  else{
    return helper.wrongInputHandler(event);
  }
};

let postbackPlace = (event) =>{
  if(event.postback.data.includes('action=location')){
    let placeDetail = place.getPlaceDetail(event.postback.data.replace("ref=place&action=location&ref_id=",''));
    placeDetail.then((data)=>{
      return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      helper.errorHandler(err, 'getPlaceDetail promise on postbackPlace', event);
    });
  }else if(event.postback.data.includes('action=distance')){
    let latitude = event.postback.data.replace("ref=place&action=distance&lat=",'').split('&long=')[0];
    let longitude = event.postback.data.replace("ref=place&action=distance&lat=",'').split('&long=')[1];
    let id='';

    if(event.source.type==='user')
      id = event.source.userId;
    else if(event.source.type === 'group')
      id = event.source.groupId;
    else
      id = event.source.roomId;

    let obj ={
      'name':'distanceToPlace',
      'displayName':null,
      'latPlace':null,
      'longPlace':null,
      'latCurrent':null,
      'longCurrent':null,
    };

    if(event.source.type==='user'){
      const logger = line.client.getProfile(id);
      logger.then((profile)=>{
        obj.displayName = profile.displayName;
        obj.latPlace = latitude;
        obj.longPlace= longitude;
        mcache.put(id, obj, 60*1000);
        return helper.replyMessage(event.replyToken, [helper.buildText('Share locationnya dong kak :3')]);
      });
    }else{
        obj.displayName = id;
        obj.latPlace = latitude;
        obj.longPlace= longitude;
        mcache.put(id, obj, 60*1000);
        return helper.replyMessage(event.replyToken, [helper.buildText('Share locationnya dong kak :3')]);
    }

  }else if(event.postback.data.includes('action=photos')){
    let getMorePhotos = place.getMorePhotos(event.postback.data.replace("ref=place&action=photos&text=",''));
    getMorePhotos.then((data)=>{
      return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      helper.errorHandler(err, 'getMorePhotos promise on postbackPlace', event);
    });
  }else if(event.postback.data.includes('action=share')){
    if(event.source.type === 'user'){
      let messageId = event.postback.data.replace('ref=place&action=share&id=','');
      shareToFriend(event, messageId);
    }else{
      return helper.replyMessage(event.replyToken, [helper.buildText('Fitur ini tidak tersedia dalam group/room')]);
    }

  }
};

let postbackEvent = (event) =>{
  if(event.postback.data.includes('action=description')){
    let getDetail = eventbrite.getDetail(event.postback.data.replace('ref=event&action=description&ref_id=',''));
    getDetail.then((data)=>{
      return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      helper.errorHandler(err, 'getDetail promise on postbackEvent', event);
    });
  }else if(event.postback.data.includes('action=getEvent')){
    let cat = event.postback.data.replace('ref=event&action=getEvent&ref_id=','').split('&lat')[0];
    let lat = event.postback.data.replace('ref=event&action=getEvent&ref_id=','').split('&lat=')[1].split('&long=')[0];
    let long = event.postback.data.replace('ref=event&action=getEvent&ref_id=','').split('&lat=')[1].split('&long=')[1];
    let getEvent = eventbrite.getEvent(lat, long, cat);
    getEvent.then((data)=>{
      if(data.type==='template'){
        return helper.replyMessage(event.replyToken, [helper.buildText(replyMessage.replyEventsAfter[0]), data]).catch((err)=>{
          console.log(err);
        });
      }else{
        let reply = replyMessage.eventsNotFounds[Math.floor(Math.random() * replyMessage.eventsNotFounds.length)];
        return helper.generateMessage(event.replyToken, reply);
      }
    }).catch((err)=>{
      helper.errorHandler(err, 'getEvent promise on postbackEvent', event);
    });
  }else if(event.postback.data.includes('action=share')){
    if(event.source.type === 'user'){
      let messageId = event.postback.data.replace('ref=event&action=share&id=','');
      shareToFriend(event, messageId);
    }else{
      return helper.replyMessage(event.replyToken, [helper.buildText('Fitur ini tidak tersedia dalam group/room')]);
    }
  }
};

let postbackRestaurant = (event) =>{
  if(event.postback.data.includes('action=detail')){
    let getDetail = eat.getDetail(event.postback.data.replace('ref=restaurant&action=detail&ref_id=',''));
    getDetail.then((data)=>{
      return helper.replyMessage(event.replyToken, data);
    }).catch((err)=>{
      helper.errorHandler(err, 'getDetail promise on postbackRestaurant', event);
    });
  }else if(event.postback.data.includes('action=share')){
    if(event.source.type === 'user'){
      let messageId = event.postback.data.replace('ref=restaurant&action=share&id=','');
      shareToFriend(event, messageId);
    }else{
      return helper.replyMessage(event.replyToken, [helper.buildText('Fitur ini tidak tersedia dalam group/room')]);
    }
  }
};

const postbackWeather = (event) => {
  let result;
  const arr = event.postback.data.split('&');
  const eventObj = arr.reduce((o, currElement) => {
    const keyArr = currElement.split('=');
    o[keyArr[0]] = keyArr[1];
    return o;
  }, {});

  switch (eventObj.action) {
    case 'detail':
      const detail = weather.getDetail(eventObj.weather,eventObj.temperature,eventObj.days);
      return helper.replyMessage(event.replyToken, [helper.buildText(detail)]);
      break;
    case 'subscribe':
      console.log('postbackWeather', event);

      if(event.source.type=='room'||event.source.type=='group') {
        result = [
          {
            "type":"text",
            "text":'Fitur ini hanya tersedia pada 1:1 chat dengan kami :)'
          }
        ];
        return helper.replyMessage(event.replyToken, result);
      }

      const subscribing = weather.subscribeUser(event.source.userId,eventObj.lat,eventObj.long);

      subscribing.then((detail) => {
        console.log('subscribeUser Promise', event.replyToken, detail);
        result = [detail];
        console.log("postbackWeather result : ",result);
        return helper.replyMessage(event.replyToken, result);
      }).catch((err) => {
        helper.errorHandler(err, 'subscribeUser on postbackWeather', event);
      });
      break;
    case 'unsubscribe':
      console.log('postbackWeather', event);
      const unsubscribe = weather.unsubscribeUser(event.source.userId);

      unsubscribe.then((detail) => {
        console.log('subscribeUser Promise', event.replyToken, detail);
        result = [detail];
        console.log("postbackWeather result : ",result);
        return helper.replyMessage(event.replyToken, result);
      }).catch((err) => {
        helper.errorHandler(err, 'unsubscribeUser on postbackWeather', event);
      });
      break;
    default:

  }
};

let postbackTravelPal = (event) =>{
  if(event.postback.data.includes('action=leavePal')){
    Chat.findOne({user_id:event.source.userId},(err,chat)=>{
      if(err) helper.errorHandler(err, 'chat.findOne (1) on postbackTravelPal', event);
      if(chat){
        helper.pushMessage(chat.pal_id, [helper.buildText('Temanmu meninggalkan obrolan.')]).then((x)=>{
          Chat.findOne({user_id:chat.pal_id},(err, chat2)=>{
            if(err) helper.errorHandler(err, 'chat.findOne (2) on postbackTravelPal', event);
            if(chat2){
              chat.remove();
              chat2.remove();
              return helper.replyMessage(event.replyToken, [helper.buildText('Kamu meninggalkan teman.\nUntuk mencari teman, bisa kembali ke menu.')]).catch((err)=>{
                console.log(err);
              });
            }
          });
        }).catch((err)=>{
          helper.errorHandler(err, 'line pushMessage on postbackTravelPal', event);
        });
      }else{
        return helper.replyMessage(event.replyToken, [helper.buildText('Maaf kak, kamu tidak memiliki teman yang terhubung. :(')]);
      }
    });
  }
};

let joinEvent = (event) => {
  if(event.source.type=='room'||event.source.type=='group'){
    let reply = replyMessage.welcomingMessage[Math.floor(Math.random() * replyMessage.welcomingMessage.length)];
    return helper.generateMessage(event.replyToken, reply);
  }
};

let followEvent = (event) =>{
  let reply = replyMessage.welcomingMessage[Math.floor(Math.random() * replyMessage.welcomingMessage.length)];
  return helper.generateMessage(event.replyToken, reply);
};

let unfollowEvent = (event) =>{
  Chat.findOne({user_id:event.source.userId}, (err, chat)=>{
    if(err) helper.errorHandler(err, 'chat.findOne (1) on unfollowEvent', event);
    if(!chat){
      mcache.del(event.source.userId);
      return helper.pushMessage(event.source.userId, [helper.buildText('Terimakasih telah menggunakan layanan kami semoga layanan kami dapat membantu')]);
    }else{
      let pal = chat.pal_id;
      let id = event.source.userId;
      mcache.del(id);
      mcache.del(pal_id);
      Chat.findOne({user_id:id}, (err, chat2)=>{
        if(err) helper.errorHandler(err, 'chat.findOne (2) on unfollowEvent', event);
        chat.remove();
        chat2.remove();
        helper.pushMessage(pal, [helper.buildText("Teman meninggalkan obrolan.")]).then((res)=>{
          return helper.pushMessage(id, [helper.buildText('Terimakasih telah menggunakan layanan kami semoga layanan kami dapat membantu')]);
        });
      });
    }
  });
};

let downloadImage = (uri, id) =>{
  return new Promise((resolve, reject)=>{
    if(uri!==null){
      request.head(uri, (err, res, body)=>{
        request(uri).pipe(fs.createWriteStream(`./public/user/${id}.jpg`)).on('close', ()=>{resolve('done');});
      });
    }else{
      resolve('https://xploria-bot.azurewebsites.net/static/user/notfound.jpg');
    }
  });
};

const checkIfUserHasChatPal = (userId) => {
  return new Promise((resolve, reject) => {
    Chat.findOne({user_id:userId}, (err, chat)=>{
      if(chat) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

const commandUser = (event, cachedBody, displayName, id, command) => {
  const logger = line.client.getProfile(id);
  logger.then((profile)=>{
    displayName = profile.displayName;

    const checkChatStatus = checkIfUserHasChatPal(id);
    checkChatStatus.then((isChat) => {
      let userMessage;
      if(event.message.type === 'text') {
        userMessage = event.message.text.toLowerCase();
      }

      if(event.message.type === 'text' && !isChat && constant.commandUser.indexOf(userMessage) === -1 ) {
        userMessage = `${processSentence(userMessage)}`;
      }

      if(event.message.type === 'text'&&constant.commandUser.indexOf(userMessage)!=-1){
        console.log('commandUser : userMessage',userMessage);
        let obj = command.find(x => x.name === userMessage);
        obj.displayName = displayName;
        mcache.put(id, obj, 60*1000);

        if(userMessage === '#lokasi'){
          let reply = replyMessage.askingLocationForPlace[Math.floor(Math.random() * replyMessage.askingLocationForPlace.length)];
          return helper.generateMessage(event.replyToken, reply, displayName).catch((err)=>{
            console.log(err);
          });
        }else if(userMessage === '#hotel'){
          let reply = replyMessage.askingLocationForHotel[Math.floor(Math.random() * replyMessage.askingLocationForHotel.length)];
          return helper.generateMessage(event.replyToken, reply, displayName);
        }else if(userMessage === '#yuk-jalan'){
          Chat.findOne({user_id:id}, (err, chat)=>{
            if(err) helper.errorHandler(err, 'chat.findOne on #yuk-jalan', event);
            if(chat){
              mcache.del(id);
              return helper.replyMessage(event.replyToken, [helper.buildText('Kamu sudah memiliki teman yang terhubung.')]);
            }else{
              let reply = `Yuk Jalan adalah layanan kami untuk kamu yang membutuhkan teman/partner jalan. Dengan layanan ini kamu bisa mendapatkan teman yang sesuai untuk mengeksplore daerah-daerah yang ada di sekitarmu. Jadi jangan batalkan agendamu. Yuk share location terlebih dahulu (tombol share location ada pada tanda plus di pojok kiri bawah yaa).`;
              return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
            }
          });
        }else if(userMessage === '#menu'){
          mcache.del(id);
          let reply = menu.getMenu();
          return helper.replyMessage(event.replyToken, reply);
        }else{
          if(userMessage==='#kuliner') {
            reply = replyMessage.askingGeoCodeForRestaurant[Math.floor(Math.random() * replyMessage.askingGeoCodeForRestaurant.length)];
            return helper.generateMessage(event.replyToken, reply, displayName);
          } else if(userMessage==='#event') {
            reply = replyMessage.askingGeoCodeForEvent[Math.floor(Math.random() * replyMessage.askingGeoCodeForEvent.length)];
            return helper.generateMessage(event.replyToken, reply, displayName);
          } else if(userMessage==='#cuaca') {
            reply = replyMessage.askingGeoCodeForWeather[Math.floor(Math.random() * replyMessage.askingGeoCodeForWeather.length)];
            return helper.generateMessage(event.replyToken, reply, displayName);
          } else if (userMessage==='#feedback') {
            reply = 'Punya kritik dan saran ?\nBeri tahu kami dengan format "email_saran" yaa :)';
            return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
          } else if (userMessage === '#about') {
            reply = 'about disini';
            return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
          }
        }
      }else{
        // do check on db
        // else if(cachedBody.latlong !== null && event.message.type==='text'){
        console.log('##########TESTING#########');
        Chat.findOne({user_id:id}, (err, chat)=>{
          if(err) helper.errorHandler(err, 'chat.findOne chat to travel pal', event);
          if(chat){
            switch(event.message.type){
              case 'text':
                return helper.pushMessage(chat.pal_id, [helper.buildText(event.message.text)]);
                break;
              case 'image':
                line.client.getMessageContent(event.message.id).then((content)=>{
                  let image = new Buffer(content, 'binary').toString('base64');
                  let store = imgur.storeOnImgur(image);
                  store.then((json)=>{
                    let thumbnail = json.replace('http://', 'https://').replace('.jpg', 't.jpg');
                    let original = json.replace('http://', 'https://').replace('.jpg', 'h.jpg');
                    return helper.pushMessage(chat.pal_id, [helper.buildImage(original, thumbnail)]).catch((err)=>{
                      if(err) helper.errorHandler('err', 'send image to userpal', event);
                      helper.pushMessage(id, [helper.buildText('Yahh gambarnya ga ke kirim kak, coba beberapa saat lagi yaa :)')]);
                    });
                  }).catch((err)=>{
                    helper.errorHandler(err, 'Send image on imgur');
                  });
                }).catch((err)=>{
                  helper.errorHandler(err, 'getMessageContent cannot get image from chat', event);
                });
                break;
              case 'video':
                return helper.replyMessage(event.replyToken,[helper.buildText('Saat ini fitur ini masih belum tersedia kak :(\nMaaf yaah...')]);
                break;
              case 'audio':
                return helper.replyMessage(event.replyToken,[helper.buildText('Saat ini fitur ini masih belum tersedia kak :(\nMaaf yaah...')]);
                break;
              case 'sticker':
                if(['1','2','3','4'].indexOf(event.message.packageId)!==-1)
                  return helper.pushMessage(chat.pal_id, [helper.buildSticker(event.message.packageId, event.message.stickerId)]);
                else
                  return helper.replyMessage(event.replyToken, [helper.buildText('Maaf kak hanya sticker standar saja yang bisa dikirim ke teman :()')]);
                break;
              case 'location':
                return helper.pushMessage(chat.pal_id, [helper.buildLocation(event.message.title, event.message.address, event.message.latitude, event.message.longitude)]);
                break;
              default:
                helper.errorHandler('error from chat', 'event type handler not set', event);
            }
          }else{
            reply = replyMessage.invalidCommand[Math.floor(Math.random() * replyMessage.invalidCommand.length)].replace("###", displayName);
            return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
          }
        });
        // }
      }
    });
  }).catch((err)=>{
    helper.errorHandler(err, 'getProfile user promise, init command', event);
  });
};

let commandGroup = (event, cachedBody, displayName, id, command) =>{
  if(event.message.type == 'text' && constant.commandGroup.indexOf(event.message.text.toLowerCase())!=-1){
    let groupMessage = event.message.text.toLowerCase();
    console.log('#############', groupMessage);
    let obj = command.find(x => x.name === groupMessage);
    obj.displayName = event.source.type === 'group'?event.source.groupId:event.source.roomId;
    console.log("_______________________________________________",obj);
    mcache.put(event.source.type === 'group'?event.source.groupId:event.source.roomId, obj, 60*1000);
    if(groupMessage === '#lokasi'){
      let reply = replyMessage.askingLocationForPlace[Math.floor(Math.random() * replyMessage.askingLocationForPlace.length)];
      return helper.generateMessage(event.replyToken, reply, '', true);
    }else if(groupMessage === '#hotel'){
      let reply = replyMessage.askingLocationForHotel[Math.floor(Math.random() * replyMessage.askingLocationForHotel.length)].replace(" ###", "");
      return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
    }else if(groupMessage === '#yuk-jalan'){
      mcache.del(event.source.type === 'group'?event.source.groupId:event.source.roomId);
      let reply = `Layanan ini hanya tersedia pada 1:1 chat dengan kami :)`;
      return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
    }else if(groupMessage === '#menu'){
      mcache.del(event.source.type === 'group'?event.source.groupId:event.source.roomId);
      let reply = menu.getMenu();
      console.log("####################", reply);
      return helper.replyMessage(event.replyToken, reply);
    }else if(groupMessage === '#bye'){
      mcache.del(event.source.type === 'group'?event.source.groupId:event.source.roomId);
      let reply = "Terimakasih telah menggunakan layanan xploria, semoga layanan yang kami berikan membantu kalian :)";
      return helper.replyMessage(event.replyToken, [helper.buildText(reply)]).then(()=>{
        if(event.source.type === 'group')
          line.client.leaveGroup(event.source.groupId);
        else
          line.client.leaveRoom(event.source.roomId);
      });
    }else{
      let reply = '';
      if(groupMessage==='#kuliner'){
        reply = replyMessage.askingGeoCodeForRestaurant[Math.floor(Math.random() * replyMessage.askingGeoCodeForRestaurant.length)];
        return helper.generateMessage(event.replyToken, reply, '', true);
      }
      else if(groupMessage==='#event'){
        reply = replyMessage.askingGeoCodeForEvent[Math.floor(Math.random() * replyMessage.askingGeoCodeForEvent.length)];
        return helper.generateMessage(event.replyToken, reply, '', true);
      }
      else if(groupMessage==='#cuaca'){
        reply = replyMessage.askingGeoCodeForWeather[Math.floor(Math.random() * replyMessage.askingGeoCodeForWeather.length)];
        return helper.generateMessage(event.replyToken, reply, '', true);
      }
      else if (groupMessage==='#feedback'){
        reply = 'Punya kritik dan saran ?\nBeri tahu kami dengan format "email_saran" yaa :)';
        return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
      }
      else if (groupMessage==='#about'){
        reply = 'about disini';
        return helper.replyMessage(event.replyToken, [helper.buildText(reply)]);
      }
    }
  }
};

let shareToFriend = (event, id) =>{
  if(event.source.type === 'user'){
    Chat.find({'user_id':event.source.userId}, (err, chat)=>{
      if(err) helper.errorHandler(err, 'Error while search chat', event);
      if(chat.length===0)
        return helper.replyMessage(event.replyToken,[helper.buildText('Maaf kak, layanan ini hanya bisa digunakan ketika ada teman yang terhubung, Gunakan layanan yuk jalan terlebih dahulu.')]);
      else{
        let share = (chat, event) =>{
          Message.findOne({_id:id}, (err, message)=>{
            if(err) helper.errorHandler(err, 'Cannot find message on postbackPlace', event);
            if(message){
              return helper.pushMessage(chat.pal_id, [JSON.parse(message.message)]).then((status)=>{
                helper.pushMessage(chat.user_id, [helper.buildText('Berhasil di-share :)')]);
              }).catch((err)=>{console.log(err);});
            }
            else
              return helper.pushMessage(chat.user_id, [helper.buildText('Message tidak ditemukan/expired.')]);
          });
        };
        share(chat[0], event);
      }
    });
  }else{
    console.log('masuk2');
    return helper.replyMessage(event.replyToken, [helper.buildText('Mohon maaf, fitur ini hanya bisa digunakan pada 1:1 chat dengan kami.')]).catch((err)=>{console.log(err);});
  }
};

app.use((req, res, next) => {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  res.status(err.status || 500);
  res.sendFile(path.join(__dirname+'/view/404.html'));
});

app.listen(process.env.PORT || 3000, () => {
  mcache.clear();
  mcache.put('search', []);
  mcache.put('waiting', []);
  console.log('Xploria app listening on port 3000!');
});
