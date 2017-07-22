const zomatoApi = require('zomato.js');
const GoogleImages = require('google-images');
const helper = require('./helper');
const Message = require('../model/message');
const key = require('../key');

const googleImages = new GoogleImages(key.images.cse_eat, key.images.api_eat);
let zomato = new zomatoApi(key.zomato.token);

let searchRestaurant = (lat, long) => {
  return new Promise((resolve, reject)=>{
    zomato.geocode({lat:lat, lon:long}).then((data)=>{
      if(data.nearby_restaurants.length!==0){
        let count = 0;
        let promises = [];
        data.nearby_restaurants.map((e)=>{
          if(count<5){
            let coloumn = helper.createColoumn("https://xploria-bot.azurewebsites.net/static/no-image.jpg", e.restaurant.name.slice(0,39), e.restaurant.location.address.slice(0,59));
            let button = helper.buildTemplate('buttons', e.restaurant.name, "https://xploria-bot.azurewebsites.net/static/no-image.jpg", e.restaurant.name.slice(0,39), e.restaurant.location.address.slice(0,59));

            coloumn.pushAction(helper.createAction('postback', 'Deskripsi', `ref=restaurant&action=detail&ref_id=${e.restaurant.id}`));
            coloumn.pushAction(helper.createAction('uri', 'Buka di web', e.restaurant.url));
            button.pushAction(helper.createAction('postback', 'Deskripsi', `ref=restaurant&action=detail&ref_id=${e.restaurant.id}`));
            button.pushAction(helper.createAction('uri', 'Buka di web', e.restaurant.url));

            promises.push(image(coloumn, e.restaurant.name, data.location.city_name, button));
            count++;
          }
        });
        let result = helper.buildTemplate('carousel', 'list restaurants');
        Promise.all(promises).then((data)=>{
          result.setColoumn(data);
          return result;
        }).then((data)=>{
          resolve(data.getTemplate);
        }).catch((err)=>{
          console.log(err);
        });
      }else{
        resolve(helper.buildText('Mohon maaf kak tidak ditemukan Restaurant di dekat sana'));
      }
    }).catch((err)=>{
      console.error(err);
      reject(err);
    });
  });
};

let image = (data, name, region, button) => {
  return new Promise((resolve, reject)=>{
    googleImages.search(name+` ${region}`, {'size':'large', 'type':'photo'}).then(images => {
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
          data.setImageUrl(e.url);
          button.setImageUrl(e.url);
          isFound=true;
        }
      });
      let store = new Message();
      store.message = JSON.stringify(button.getTemplate);
      store.save((err)=>{
        if(err) helper.errorHandler(err, 'Save message on searchRestaurant');
        data.pushAction(helper.createAction('postback', 'Bagikan', `ref=restaurant&action=share&id=${store._id}`));
        resolve(data.getColoumn);
      });
    }).catch((err)=>{
      data.setImageUrl('https://xploria-bot.azurewebsites.net/static/no-image.jpg');
      button.setImageUrl('https://xploria-bot.azurewebsites.net/static/no-image.jpg');
      isFound=true;
      let store = new Message();
      store.message = JSON.stringify(button.getTemplate);
      store.save((err)=>{
        if(err) helper.errorHandler(err, 'Save message on searchRestaurant');
        data.pushAction(helper.createAction('postback', 'Bagikan', `ref=restaurant&action=share&id=${store._id}`));
        resolve(data.getColoumn);
      });
    });
  });
};

let getDetail = (id) => {
  return new Promise((resolve, reject)=>{
    zomato.restaurant({res_id: id}).then((data) => {
      let result = [
        helper.buildText(`${data.name}\nAlamat : ${data.location.address}\nRating : ${data.user_rating.aggregate_rating} (${data.user_rating.rating_text})\nMasakan : ${data.cuisines}\nHarga : ${data.currency} ${data.average_cost_for_two} untuk 2 orang.`),
        helper.buildLocation(data.name,data.location.address,data.location.latitude,data.location.longitude)
      ];
      resolve(result);
  })
  .catch((err) => {
    console.error(err);
  });
  });
};

module.exports = {
  searchRestaurant:searchRestaurant,
  getDetail:getDetail
};
