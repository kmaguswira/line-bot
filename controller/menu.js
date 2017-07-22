let getMenu = () => {
  let menu = [{
    "type": "imagemap",
    "baseUrl": "https://xploria-bot.azurewebsites.net/static/menuv2",
    "altText": "xploria-menu",
    "baseSize": {
        "height": 1040,
        "width": 1040
    },
    "actions": [
        {
            "type": "message",
            "text": "#about",
            "area": {
                "x": 0,
                "y": 0,
                "width": 1040,
                "height": 199
            }
        },
        {
            "type": "message",
            "text": "#yuk-jalan",
            "area": {
                "x": 1,
                "y": 200,
                "width": 346,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#lokasi",
            "area": {
                "x": 347,
                "y": 200,
                "width": 347,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#kuliner",
            "area": {
                "x": 694,
                "y": 200,
                "width": 345,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#event",
            "area": {
                "x": 1,
                "y": 576,
                "width": 346,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#cuaca",
            "area": {
                "x": 347,
                "y": 576,
                "width": 347,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#hotel",
            "area": {
                "x": 694,
                "y": 576,
                "width": 345,
                "height": 376
            }
        },
        {
            "type": "message",
            "text": "#feedback",
            "area": {
                "x": 0,
                "y": 952,
                "width": 1040,
                "height": 89
            }
        }
    ]
  }];

  return menu;
};

module.exports = {
  getMenu:getMenu
};
