const GooglePlaces = require('googleplaces');
const GoogleImages = require('google-images');
const key = require('../key');

const searchHotels = (location,checkIn,checkOut) => {
  return new Promise((resolve,reject) => {
    let url = key.booking.url;
    url = `${url}?aid${key.booking.aid}&ss=${location}`;

    console.log('check date : ',checkIn.getFullYear(),checkIn.getMonth());

    const checkInUrl = `checkin_monthday=${checkIn.getDate()}&checkin_year_month=${checkIn.getFullYear()}-${checkIn.getMonth()+1}`;
    const checkOutUrl = `checkout_monthday=${checkOut.getDate()}&checkout_year_month=${checkOut.getFullYear()}-${checkOut.getMonth()+1}`;

    const finalUrl = `${url}&${checkInUrl}&${checkOutUrl}`;

    console.log('searchHotel promise : ',finalUrl)
    const item = {
      "thumbnailImageUrl":'https://pbs.twimg.com/profile_images/741334762221096960/iKNX2-i9.jpg',
      "title": 'Hotels From Booking.com',
      "text": 'Ditemukan 10+ hotel',
      "actions": [
          {
            "type": "uri",
            "label": "Liat hotel",
            "uri": finalUrl.replace(" ", "+")
          },
      ]
    };

    const result = [{
      "type": "template",
      "altText": "Hotels",
      "template": {
          "type": "carousel",
          "columns": [item]
      }
    }];

    resolve(result);
  });
};


module.exports = {
  searchHotels,
};
