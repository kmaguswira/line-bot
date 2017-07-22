const mongoose = require('mongoose');
let messageSchema = mongoose.Schema({
  message:{
    type:String
  },
  expireAt:{
    type:Date,
    expires:60*60*24*2,
    default:Date.now
  }
});

module.exports = mongoose.model('Message', messageSchema);
