const eventbriteAPI = require('node-eventbrite');
const key = require('../key');
const helper = require('./helper');
const Message = require('../model/message');

const eventBrite = eventbriteAPI({token: key.eventBrite.token, version : 'v3'});

let getCategories = (lat, long) =>{
  return new Promise((resolve, reject)=>{
        let result = [
          helper.buildText('Mau pilih kategori event yang mana kak ?'),
          {
          "type": "template",
          "altText": "list events",
          "template": {
              "type": "carousel",
              "columns": [
                {
                  "thumbnailImageUrl":"https://xploria-bot.azurewebsites.net/static/entertaiment.jpg",
                  "title":'ENTERTAIMENT',
                  "text": 'Event - hiburan menarik dikotamu',
                  "actions": [
                      {
                        "type": "postback",
                        "label": "Film & Media",
                        "data": `ref=event&action=getEvent&ref_id=104&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Arts",
                        "data": `ref=event&action=getEvent&ref_id=105&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Music",
                        "data": `ref=event&action=getEvent&ref_id=103&lat=${lat}&long=${long}`
                      }
                  ]
                },
                {
                  "thumbnailImageUrl":"https://xploria-bot.azurewebsites.net/static/education.jpg",
                  "title":'EDUCATION',
                  "text": 'Event - Tambah wawasanmu dengan mengikuti event ini',
                  "actions": [
                      {
                        "type": "postback",
                        "label": "Family & Education",
                        "data": `ref=event&action=getEvent&ref_id=115&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Science & Tech",
                        "data": `ref=event&action=getEvent&ref_id=102&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Business",
                        "data": `ref=event&action=getEvent&ref_id=101&lat=${lat}&long=${long}`
                      }
                  ]
                },
                {
                  "thumbnailImageUrl":"https://xploria-bot.azurewebsites.net/static/lifestyle.jpg",
                  "title":'LIFESTYLE',
                  "text": 'Event - Lengkapi harimu dengan event ini',
                  "actions": [
                      {
                        "type": "postback",
                        "label": "Hobbies",
                        "data": `ref=event&action=getEvent&ref_id=119&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Home & Lifestyle",
                        "data": `ref=event&action=getEvent&ref_id=117&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Health",
                        "data": `ref=event&action=getEvent&ref_id=107&lat=${lat}&long=${long}`
                      }
                  ]
                },
                {
                  "thumbnailImageUrl":"https://xploria-bot.azurewebsites.net/static/interest.jpg",
                  "title":'INTEREST',
                  "text": 'Event - Hadiri event kesukaanmu berikut',
                  "actions": [
                      {
                        "type": "postback",
                        "label": "Travel & Outdoor",
                        "data": `ref=event&action=getEvent&ref_id=109&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Sports & Fitness",
                        "data": `ref=event&action=getEvent&ref_id=108&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Food & Drink",
                        "data": `ref=event&action=getEvent&ref_id=110&lat=${lat}&long=${long}`
                      }
                  ]
                },
                {
                  "thumbnailImageUrl":"https://xploria-bot.azurewebsites.net/static/other.jpg",
                  "title":'OTHER',
                  "text": 'Event - Ikuti event menarik lainnya',
                  "actions": [
                      {
                        "type": "postback",
                        "label": "Fashion",
                        "data": `ref=event&action=getEvent&ref_id=106&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Spirituality",
                        "data": `ref=event&action=getEvent&ref_id=114&lat=${lat}&long=${long}`
                      },
                      {
                        "type": "postback",
                        "label": "Charity & Causes",
                        "data": `ref=event&action=getEvent&ref_id=111&lat=${lat}&long=${long}`
                      }
                  ]
                }
              ]
          }
        }];
        resolve(result);
  });
};

let getDetail = (id)=>{
  return new Promise((resolve, reject)=>{
    eventBrite.event_details({'event_id':id}, (error, data)=>{
      let result = [helper.buildText(data.description.text.slice(0,1999))];
      resolve(result);
    });
  });
};

let getEvent = (lat, long, cat_id="") => {
  return new Promise((resolve, reject)=>{
    eventBrite.search({ 'location.latitude': lat, 'location.longitude':long, 'sort_by':'date', 'categories':cat_id }, (error, data) => {
        if (error){
          reject(error.message);
        }else{
          if(data.events.length!==0){
            let result = helper.buildTemplate('carousel', 'list events');
            let promises =[];
            let count = 0;
            data.events.map((e)=>{
              if(count<5){
                promises.push(promiseToStore(e));
                count++;
              }
            });
            Promise.all(promises).then((data)=>{
              result.setColoumn(data);
            }).then(()=>{
              resolve(result.getTemplate);
            }).catch((err)=>{
              helper.errorHandler(err, 'Promises on getEvent');
            });
          }else{
            resolve(helper.buildText('Tidak ada event di dekat sini'));
          }
        }
    });
  });
};

let promiseToStore = (e) =>{
  return new Promise((resolve, reject)=>{
    let makeColumn = helper.createColoumn("https://xploria-bot.azurewebsites.net/static/no-image.jpg",e.is_free?'Free Event':'Paid Event',e.name.text.slice(0,55));
    makeColumn.pushAction(helper.createAction('postback', 'Deskripsi', `ref=event&action=description&ref_id=${e.id}`));
    makeColumn.pushAction(helper.createAction('uri', 'Buka di web', e.url));

    let storeOnDb = helper.buildTemplate('buttons', e.name.text.slice(0,55), "https://xploria-bot.azurewebsites.net/static/no-image.jpg", e.is_free?'Free Event':'Paid Event',e.name.text.slice(0,55));
    storeOnDb.pushAction(helper.createAction('postback', 'Deskripsi', `ref=event&action=description&ref_id=${e.id}`));
    storeOnDb.pushAction(helper.createAction('uri', 'Buka di web', e.url));

    if(e.logo.crop_mask.width<=1024&&e.logo.crop_mask.height<=1024&&e.logo.url.includes("https://")){
      makeColumn.setImageUrl(e.logo.url);
      storeOnDb.setImageUrl(e.logo.url);
    }

    let share = new Message();
    share.message = JSON.stringify(storeOnDb.getTemplate);
    share.save((err)=>{
      if(err) helper.errorHandler(err, 'save meesage on getEvent', JSON.stringify(storeOnDb));
      makeColumn.pushAction(helper.createAction('postback', 'Bagikan', `ref=event&action=share&id=${share._id}`));
      resolve(makeColumn.getColoumn);
    });
  });
};
module.exports = {
  getEvent:getEvent,
  getDetail:getDetail,
  getCategories:getCategories
};
