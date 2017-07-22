const imgur = require('imgur');
const helper = require('./helper');
const key = require('../key');

let storeOnImgur = (data) => {
  return new Promise((resolve, reject)=>{
    imgur.setCredentials(key.imgur.em, key.imgur.ps, key.imgur.id);
    imgur.uploadBase64(data)
    .then(function (json) {
        console.log(json.data.link);
        resolve(json.data.link);
    })
    .catch(function (err) {
        helper.errorHandler(err, 'storeOnImgur cannot store', event);
    });
  });
};

module.exports = {
storeOnImgur:storeOnImgur
};
