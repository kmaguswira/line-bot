const openWeatherAPI = require('openweather-apis');
const superagent = require('superagent');

const replyMessage = require('../replyMessage');
const key = require('../key');
const helper = require('./helper');
const Subscribes = require('../model/subscribes');
const Users = require('../model/users');

const days = [
  'Hari Ini',
  'Besok',
  'Besok Lusa'
];

const weatherConfig = {
  "baseAssetUrl": "https://xploria-bot.azurewebsites.net/static/weather/"
};

openWeatherAPI.setLang('en');
openWeatherAPI.setAPPID(key.openWeather.token);

const subscribeUser = (userId, latitude, longitude) => {
  return new Promise((resolve, reject) => {
    const city = getCity(latitude, longitude);
    const checkUser = checkIfUserAlreadySubscribed(userId);
    checkUser.then((user) => {
      if(user) {
        resolve(helper.buildText('kamu sudah berlangganan cuaca sebelumnya.'));
        return;
      };

      city.then((loc) => {
        // check if city already existed on DB
        // if above 'true' --->  store userId on DB -> subscribes
        // else ---> store city on DB then do above
        Subscribes.findOne({'location':loc}, (err, subs) => {
          if(err) console.log(err);


          if(!subs) {
            const timezone = getTimezone(latitude, longitude);
            timezone.then((timeZ) => {
              const newSubscribes = new Subscribes();


              newSubscribes.location = loc;
              newSubscribes.timezone = timeZ;
              newSubscribes.subscribers = [{user_id:userId}];
              newSubscribes.save((err) => {
                if(err) reject(err);
                resolve(helper.buildText('selamat,kamu telah berlangganan info cuaca.'));
                saveUserId(userId,loc);
              });

            });
          } else {
            subs.subscribers.push({user_id:userId});
            subs.save((err) => {
              if(err) reject(err);
              resolve(helper.buildText('selamat,kamu telah berlangganan info cuaca.'));
              saveUserId(userId,loc);
            });
          }
        });
      }).catch((err) => {
        helper.errorHandler(err, 'getCity on subscribeUser', `${latitude} : ${longitude}`);
      });
    });

  });
}

const checkIfUserAlreadySubscribed = (userId) => {
  return new Promise((resolve, reject) => {
    Users.findOne({user_id:userId}, (err,user) => {
      if(err) reject(err);

      if(user) {
        resolve(userId);
      } else {
        resolve(null);
      }
    })
  });
}

const unsubscribeUser = (userId) => {
  return new Promise((resolve, reject) => {
    Users.findOne({user_id:userId}, (err, user) => {
      if(err) reject(err);
      console.log('user found',user);
      if(!user) {
        resolve(helper.buildText('maaf data tidak ditemukan.'));
        return;
      }

      if(!user.subscribe_weather) {
        resolve(helper.buildText('kamu telah berhenti berlangganan info cuaca sebelumnya.'));
        return;
      }

      Subscribes.findOne({location:user.location}, (errSubs,subs) => {
        if(errSubs) reject(errSubs);
        subs.subscribers = subs.subscribers.filter( (e,i) => {
          return e.user_id !== userId;
        });
        subs.save((errSubsSave) => {
          if(errSubsSave) reject(errSubsSave);
          Users.remove({user_id:userId}, (delErr) => {
            resolve(helper.buildText('kamu telah berhenti berlangganan info cuaca.'));
          });
        });
      });


    })
  });
}

const saveUserId = (userId,location) => {
  const newUsers = new Users();
  newUsers.user_id = userId;
  newUsers.subscribe_weather = true;
  newUsers.location = location;
  newUsers.save((err) => {
    if(err) reject(err);
  });
}

const getSubscribers = (timestamp) => {
  return new Promise((resolve, reject) => {
    Subscribes.find({timezone:timestamp},null, null, (err,res) => {
      if(err) console.log(err);
      if(res) {
        resolve(res);
      } else {
        reject('timezone location not found');
      }
    });
  });
};

const getCity = (lat, long) => {
  return new Promise((resolve, reject) => {
    superagent.get("https://maps.googleapis.com/maps/api/geocode/json")
    .query({ key:'AIzaSyBiC-ddv5G4EDS5xY5h7wF4RTGglNljYLA', latlng: `${lat}, ${long}` })
    .end((err, res) => {
      if(err) reject(err);
      //console.log("City : ",res);
      const txt = JSON.parse(res.text);
      if(txt.results.length!==0){
        const region =txt.results[0].address_components.filter((x)=>{
          return x.types.indexOf('administrative_area_level_2')!==-1;
        });
        if(region.length!==0)
          resolve(region[0].long_name);
        else
          reject('Lokasi tidak ditemukan mohon ulangi sekali lagi');
      }else{
        reject('Lokasi tidak ditemukan mohon ulangi sekali lagi');
      }
    });
  });
}

const getTimezone = (lat, long) => {
  return new Promise((resolve, reject) => {
    superagent.get("https://maps.googleapis.com/maps/api/timezone/json")
    .query({ key:'AIzaSyBiC-ddv5G4EDS5xY5h7wF4RTGglNljYLA',
      location: `${lat}, ${long}`,
      timestamp:'1331161200'})
    .end((err, res) => {
      if(err) reject(err);
      const obj = JSON.parse(res.text);
      if(obj.status === "OK"){
        resolve(obj.rawOffset);
      }else{
        reject('Zona waktu tidak ditemukan mohon ulangi sekali lagi');
      }
    });
  });
}

const getWeatherByLocation = (location) => {
  return new Promise((resolve, reject) => {
    openWeatherAPI.setCity(location);
    openWeatherAPI.getAllWeather((err,JSONObj) => {
      if(JSONObj) {
        const currWeather = `perkiraan cuaca hari ini adalah ${JSONObj.weather[0].description}`;
        const currTemp = `dengan suhu ${JSONObj.main.temp} derajat celsius`;
        /*
        const result = [{
          "type": "text",
          "text": `${currWeather}, ${currTemp}.`
        }];
        /*/
        const result = [{
          "type": "json",
          "data": JSONObj
        }];
        //*/
        resolve(result);
      } else {
        const result = [{
          "type": "text",
          "text": `Maaf perkiraan cuaca di tempat ini tidak ditemukan`
        }];
        resolve(result);
      }
    });
  });

};

const getWeatherForecast = (lat, long) => {
  console.log('getWeatherForecast',lat,long);
  return new Promise((resolve, reject) => {
    openWeatherAPI.setCoordinate(lat, long);
    openWeatherAPI.getWeatherForecastForDays(3,(err,JSONObj) => {
      let result;
      console.log('getWeatherForecast promise',err,JSONObj)
      if(JSONObj) {
        /*
        result = [{
          "type": "json",
          "data": JSONObj
        }];
        /*/

        result = [
          helper.buildText('Ini kak prakiraan cuaca buat hari ini, besok dan lusa')
          ,{
            "type": "template",
            "altText": "list weathers",
            "template": {
                "type": "carousel",
                "columns": []
            }
          }
        ];

        result[1].template.columns = JSONObj.list.map( (e,i) => {
          const weatherType = replyMessage.weatherType[e.weather[0].main];
          const currWeather = `Cuaca diperkirakan ${weatherType}`;
          const currTemp = `dengan suhu ${e.temp.day} derajat celsius`;

          let newVal = {
            "thumbnailImageUrl":`${weatherConfig.baseAssetUrl}${e.weather[0].main.toLowerCase()}.jpg`,
            "title": days[i],
            "text": limitString(`${currWeather}`),
            "actions": [
                {
                  "type": "postback",
                  "label": "Detail",
                  "data": `ref=weather&days=${i}&action=detail&weather=${weatherType}&temperature=${e.temp.day}&ref_id=${e.dt}`
                },
                {
                  "type": "postback",
                  "label": "Subscribe",
                  "data": `ref=weather&action=subscribe&lat=${lat}&long=${long}&ref_id=${e.dt}`
                },
            ]
          };

          return newVal;
        });

      } else {
        result = [{
          "type": "text",
          "text": `Maaf perkiraan cuaca di tempat ini tidak ditemukan`
        }];
      }
      resolve(result);
    });
  });

};

const sendWeatherToSubscriber = (arr, location) =>{
  return new Promise((resolve, reject)=>{
    openWeatherAPI.setCity(location);
    openWeatherAPI.getAllWeather((err,JSONObj) => {
      if(JSONObj) {
        const currWeather = `perkiraan cuaca hari ini adalah ${JSONObj.weather[0].description}`;
        const currTemp = `dengan suhu ${JSONObj.main.temp} derajat celsius`;
        const weatherType = replyMessage.weatherType[JSONObj.weather[0].main];

        const detailAction = `ref=weather&action=detail&weather=${JSONObj.weather[0].description}&temperature=${JSONObj.main.temp}`
        const unsubscribeAction = `ref=weather&action=unsubscribe`;

        let button = helper.buildTemplate('buttons', 'Cuaca hari ini', `${weatherConfig.baseAssetUrl}${JSONObj.weather[0].main.toLowerCase()}.jpg`, 'Cuaca hari ini', `Cuaca diperkirakan ${replyMessage.weatherType[JSONObj.weather[0].main]}` );
        button.pushAction(helper.createAction('postback','Detail',detailAction));
        button.pushAction(helper.createAction('postback','Unsubscribe',unsubscribeAction));
        helper.multicast(arr, [button.getTemplate]).then((x)=>{
          resolve(x);
        }).catch((err)=>{
          console.log(err);
        });
      } else {
        const result = [{
          "type": "text",
          "text": `Maaf perkiraan cuaca di tempat ini tidak ditemukan`
        }];
        resolve(result);
      }
    });
  });
};

const getDetail = (weatherDesc, temperature, selDay) => {
  const currDay = days[selDay].toLowerCase();
  const currWeather = replyMessage.replyWeatherDetail[0].message
    .replace('***',currDay)
    .replace('###',weatherDesc)
    .replace('$$$',temperature);

  return `${currWeather}`;
}

const limitString = (string) => {
  if(string.length < 60) {
    return string;
  }

  return string.substr(0,50)+'...';
}

module.exports = {
  subscribeUser,
  unsubscribeUser,
  getSubscribers,
  getWeatherByLocation,
  getWeatherForecast,
  limitString,
  getDetail,
  sendWeatherToSubscriber
};
