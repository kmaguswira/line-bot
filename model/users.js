const mongoose = require('mongoose');
const usersSchema = mongoose.Schema({
  user_id:{
    type:String
  },
  subscribe_weather:{
    type:Boolean
  },
  location:{
    type:String
  }
});

module.exports = mongoose.model('Users', usersSchema);
