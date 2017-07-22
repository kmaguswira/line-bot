const line = require('node-line-bot-api');

let buildText = (text) =>{
  return {
    "type":"text",
    "text":text
  };
};

let buildImage = (original, preview) =>{
  return {
    "type": "image",
    "originalContentUrl": original,
    "previewImageUrl": preview
  };
};

let buildVideo = (original, preview) =>{
  return {
    "type": "video",
    "originalContentUrl": original,
    "previewImageUrl": preview
  };
};

let buildAudio = (original, duration) =>{
  return {
    "type": "audio",
    "originalContentUrl": original,
    "duration": duration
  };
};

let buildLocation = (title, address, lat, long) =>{
  return {
    "type": "location",
    "title": title,
    "address": address,
    "latitude": lat,
    "longitude": long
  };
};

let buildSticker = (packageId, stickerId) =>{
  return {
    "type": "sticker",
    "packageId": packageId,
    "stickerId": stickerId
  };
};

let buildImageMap = (base, alt, height, width) =>{
  let obj = {};
  obj.type = "imagemap";
  obj.baseUrl = base;
  obj.altText = alt;
  obj.baseSize = {"height":height, "width":width};
  obj.actions = [];

  let addAction = (type, param, x, y, width, height)=>{
    let action = {};
    action.type = type;
    if(type === 'uri')
      action.linkUri = param;
    else if(type === 'message')
      action.text = param;
    else
      errorHandler('Creating image map', 'buildImageMap', 'wrong type addAction');

      action.area = {x:x, y:y, width:width, height:height};
      obj.actions.push(action);
  };

  return {addAction:addAction, getImageMap:obj};
};

let buildTemplate = (template, alt, url=null, title=null, text=null) =>{
  let obj = {};
  obj.type = 'template';
  obj.altText = alt;

  if(template === 'buttons')
    obj.template= {type:'buttons', thumbnailImageUrl:url, title:title, text:text, actions:[]};
  else if(template === 'confirm')
    obj.template = {type:'confirm', text:text, actions:[]};
  else if(template === 'carousel')
    obj.template = {type:'carousel', columns:[]};
  else
    errorHandler('Creating template', 'buildTemplate', 'wrong template type');


  let pushColoumn = (coloumn) => {
    obj.template.columns.push(coloumn);
  };

  let setColoumn = (coloumn) => {
    obj.template.columns = coloumn;
  };

  let pushAction = (action) => {
      obj.template.actions.push(action);
  };

  let setImageUrl = (url) => {
    obj.template.thumbnailImageUrl = url;
  };

  return {pushAction, pushColoumn, setColoumn:setColoumn, getTemplate:obj, setImageUrl};
};

let createColoumn = (url, title, text) =>{
    let coloumn = {};
    coloumn.thumbnailImageUrl = url;
    coloumn.title = title;
    coloumn.text = text;
    coloumn.actions = [];

    let pushAction = (action) =>{
      coloumn.actions.push(action);
    };

    let setImageUrl = (url) =>{
      coloumn.thumbnailImageUrl = url;
    };
    return {pushAction:pushAction, getColoumn:coloumn, setImageUrl:setImageUrl};
};

let createAction = (type, label, param, text=null) => {
    let action = {};
    action.type = type;
    action.label = label;
    if(type === 'postback')
      action.data = param;
    else if(type === 'uri')
      action.uri = param;
    else if(type === 'message')
      action.text = param;
    else
      errorHandler('Creating action', 'createAction', 'wrong action type');

    return action;
};

let replyMessage = (token, messages) =>{
  return line.client
    .replyMessage({
      replyToken: token,
      messages: messages
    });
};

let pushMessage = (userId, messages) =>{
  return line.client
    .pushMessage({
      to: userId,
      messages: messages
    });
};

let multicast = (users, messages) =>{
  return line.client
    .multicast({
      to: users,
      messages: messages
    });
};

let generateMessage = (token, obj, name='', isGroup=false) =>{
  if(obj.packageId === null)
      return replyMessage(token, [buildText(obj.message.replace(isGroup?' ###':'###', name))]);
  else
    return replyMessage(token, [buildText(obj.message.replace(isGroup?' ###':'###', name)), buildSticker(obj.packageId, obj.stickerId)]);
};

let wrongInputHandler = (event) => {
  return replyMessage(event.replyToken, [buildText("Inputan yang kamu masukkan salah, mohon ulangi sekali lagi")]);
};

let errorHandler = (err, from='unknown', detail='not provided') =>{
  console.log(`#################################################################\n
ERROR FROM : ${from}\nEVENT DETAIL : ${detail}\nERROR MESSAGE : ${err}\n
#################################################################`);
};

module.exports = {
  buildText:buildText,
  buildImage:buildImage,
  buildVideo:buildVideo,
  buildAudio:buildAudio,
  buildLocation:buildLocation,
  buildSticker:buildSticker,
  buildImageMap:buildImageMap,
  buildTemplate:buildTemplate,
  createColoumn:createColoumn,
  createAction:createAction,
  replyMessage:replyMessage,
  pushMessage:pushMessage,
  multicast:multicast,
  generateMessage:generateMessage,
  wrongInputHandler:wrongInputHandler,
  errorHandler:errorHandler
};
