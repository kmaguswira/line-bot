const mongoose = require('mongoose');
let chatSchema = mongoose.Schema({
  user_id:{
    type:String
  },
  pal_id:{
    type:String
  }
});

module.exports = mongoose.model('Chat', chatSchema);
