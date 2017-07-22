const mongoose = require('mongoose');

const subscribeSchema = mongoose.Schema({
  location:{
    type:String
  },
  timezone:{
    type:String
  },
  subscribers:[
    {
      user_id:String
    }
  ]
});

module.exports = mongoose.model('Subscribes', subscribeSchema);
