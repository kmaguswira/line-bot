const GooglePlaces = require('googleplaces');
const GoogleImages = require('google-images');
const key = require('../key');
const helper = require('./helper');
const Message = require('../model/message');
const replyMessage = require('../replyMessage');

const googleImages = new GoogleImages(key.images.cse_place, key.images.api_place);
const googlePlaces = new GooglePlaces(key.places.api, 'json');

let searchPlaceByText = (text)=>{
  return new Promise((resolve, reject)=>{
    let parameters = {
        query: text
    };
    googlePlaces.textSearch(parameters, (error, response)=>{
        if (error) reject(error);
        if(response.results.length>0){
          let result = helper.buildTemplate('buttons', response.results[0].name, "https://xploria-bot.azurewebsites.net/static/no-image.jpg",response.results[0].name.slice(0,39),response.results[0].formatted_address.slice(0,59));
          result.pushAction(helper.createAction('postback', 'Lokasi', `ref=place&action=location&ref_id=${response.results[0].reference}`));
          result.pushAction(helper.createAction('postback', 'Jarak', `ref=place&action=distance&lat=${response.results[0].geometry.location.lat}&long=${response.results[0].geometry.location.lng}`));

          let country = response.results[0].formatted_address.split(', ');

          googleImages.search(text+` ${country[country.length-1]}`, {'size':'large', 'type':'photo'}).then(images => {
            let isFound = false;
            images.map((e)=>{
              if(e.type =="image/jpeg"&&
                e.width < 1024 &&
                e.height < 1024 &&
                e.thumbnail.width < 240 &&
                e.thumbnail.height < 240 &&
                e.url.includes("https://") &&
                e.thumbnail.url.includes("https://")&&
                !isFound
              ){
                result.setImageUrl(e.url);
                result.pushAction(helper.createAction('postback', 'Foto', `ref=place&action=photos&text=${text}`));
                isFound=true;
              }
            });
            let storeOnDb = new Message();
            storeOnDb.message = JSON.stringify(result.getTemplate);
            storeOnDb.save((err)=>{
              if(err) helper.errorHandler(err, 'Cannot save place message on DB');
              result.pushAction(helper.createAction('postback', 'Bagikan', `ref=place&action=share&id=${storeOnDb._id}`));
              let reply = replyMessage.replyLandmarkLocation[Math.floor(Math.random() * replyMessage.replyLandmarkLocation.length)];
              console.log(reply);
              resolve([helper.buildText(reply), result.getTemplate]);
            });
          }).catch((err)=>{
            console.log(err);
            result.pushAction(helper.createAction('postback', 'Foto', `ref=place&action=photos&text=${text}`));
            isFound=true;
            let storeOnDb = new Message();
            storeOnDb.message = JSON.stringify(result.getTemplate);
            storeOnDb.save((err)=>{
              if(err) helper.errorHandler(err, 'Cannot save place message on DB');
              result.pushAction(helper.createAction('postback', 'Bagikan', `ref=place&action=share&id=${storeOnDb._id}`));
              let reply = replyMessage.replyLandmarkLocation[Math.floor(Math.random() * replyMessage.replyLandmarkLocation.length)];
              console.log(reply);
              resolve([helper.buildText(reply), result.getTemplate]);
            });
          });
        }else{
          reject([helper.buildText(`Hasil pencarian ${text} tidak di temukan.`)]);
        }

    });


  });
};

let searhNearbyHotels = (lat, lon) =>{
  return new Promise((resolve, reject)=>{
    let parameters = {
        location: [lat, lon],
        types: 'lodging'
    };

    googlePlaces.placeSearch(parameters, (err, data)=>{
      if(data.results.length!==0){
        let result = {
          "type": "template",
          "altText": "list hotels",
          "template": {
              "type": "carousel",
              "columns": []
          }
        };
        let count = 0;
        data.results.map((e)=>{
          if(count<5){
            let event = {
              "title": e.name.slice(0,39),
              "text": e.vicinity.slice(0,55),
              "actions": [
                  {
                      "type": "uri",
                      "label": "Open in web",
                      "uri": 'https://google.com'
                  }
              ]
            };
            result.template.columns.push(event);
            count++;
          }
        });
        resolve(result);
      }else{
        resolve(helper.buildText(`Tidak ada penginapan di dekat ${location}`));
      }
    });
  });
};

let getPlaceDetail = (ref) => {
  return new Promise((resolve, reject)=>{
    googlePlaces.placeDetailsRequest({reference: ref}, function (error, response) {
        if (error) helper.errorHandler(error, 'googlePlaces.placeDetailsRequest promise on getPlaceDetail', ref);
        resolve([helper.buildLocation(response.result.name,response.result.formatted_address,response.result.geometry.location.lat,response.result.geometry.location.lng)]);
    });
  });
};

let getMorePhotos = (key) =>{
    return new Promise((resolve, reject)=>{
      googleImages.search(key, {'size':'large', 'type':'photo'}).then(images => {
        let count = 0;
        let result = [];
        let isFound = false;

        images.map((e)=>{
          if(e.type =="image/jpeg"&&
            e.width < 1024 &&
            e.height < 1024 &&
            e.thumbnail.width < 240 &&
            e.thumbnail.height < 240 &&
            e.url.includes("https://") &&
            e.thumbnail.url.includes("https://")&&
            count<4
          ){
            if(!isFound){
              isFound = true;
              result.push(helper.buildText(replyMessage.replyLandmarkPhotos[Math.floor(Math.random() * replyMessage.replyLandmarkPhotos.length)]));
            }
            result.push(helper.buildImage(e.url, e.thumbnail.url));
            count++;
          }
        });
        if(isFound){
          resolve(result);
        }else{
          resolve(result.push(helper.buildText('Maaf kak, foto lainnya tidak ditemukan.')));
        }
      }).catch((err)=>{
        resolve([helper.buildText('Maaf kak, foto lainnya tidak ditemukan.')]);
      });
    });
};

let calculateDistance = (lat1, lon1, lat2, lon2) =>{
  return new Promise((resolve, reject)=>{
    let R = 6371;
    let dLat = (lat2-lat1)*(Math.PI/180);
    let dLon = (lon2-lon1)*(Math.PI/180);
    let a =
     Math.sin(dLat/2) * Math.sin(dLat/2) +
     Math.cos((lat1*(Math.PI/180))) * Math.cos((lat2*(Math.PI/180))) *
     Math.sin(dLon/2) * Math.sin(dLon/2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    let d = Math.round( (R * c) * 10 ) / 10;
    let reply = replyMessage.replyLandmarkDistance[Math.floor(Math.random() * replyMessage.replyLandmarkDistance.length)];
    resolve({reply:reply, d:d});
  });
};

module.exports={
  searchPlaceByText:searchPlaceByText,
  searhNearbyHotels:searhNearbyHotels,
  getPlaceDetail:getPlaceDetail,
  getMorePhotos:getMorePhotos,
  calculateDistance:calculateDistance
};
