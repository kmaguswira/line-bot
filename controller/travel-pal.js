const mcache = require('memory-cache');
const superagent = require('superagent');
const Chat = require('../model/chat');
const helper = require('./helper');

let checkLocation = (event, id) => {
  return new Promise((resolve, reject)=>{
    let cachedBody = mcache.get(id);
    cachedBody.latlong = `${event.message.latitude},${event.message.longitude}`;
    mcache.del(id);
    mcache.put(id, cachedBody);

    let city = getCities(event.message.latitude, event.message.longitude);
    city.then((res)=>{
      helper.pushMessage(id, [helper.buildText(`Tunggu yaa kak, masih mencari teman disekitar ${res}`)]);
      //get searcher on their location
      let search = mcache.get('search');
      let getSearcher = search.filter((x)=>{
        return x.location === res;
      });

      //get waiter on their location
      let waiting = mcache.get('waiting');
      let getWaiter = waiting.filter((x)=>{
        return x.location === res;
      });

      //check if there is not searcher
      if(getSearcher.length===0){
        search.push({'location':res, 'user':id});
        //update cache
        mcache.del('search');
        mcache.put('search', search);
        console.log('############SEARCHER##########',mcache.get('search'));

        //looking for waiter
        let findPal = lookingForWaiter(res);
        findPal.then((pal)=>{
          //todo : store on db
          Chat.findOne({'user_id':id}, (err, chat1)=>{
            if(err) console.log(err);
            if(!chat1){
              Chat.findOne({'user_id':pal}, (err,chat2)=>{
                if(err) console.log(err);
                if(!chat2){
                  let newChat1 = new Chat();
                  newChat1.user_id = id;
                  newChat1.pal_id = pal;

                  let newChat2 = new Chat();
                  newChat2.user_id = pal;
                  newChat2.pal_id = id;

                  newChat1.save((err)=>{
                    if(err) console.log(err);
                    else newChat2.save((err)=>{
                      if(err) console.log(err);
                      let reply = {
                        status:'200',
                        id:id,
                        pal:pal,
                        location:res
                      };
                      resolve(reply);
                    });
                  });
                }else{
                  reject('user already chatted');
                }
              });
            }else{
              reject('user already chatted');
            }
          });
        }).catch((err)=>{
          console.log(err);
          let reply={
            status:'404',
            id:id,
            location:res
          };
          resolve(reply);
        });

      }else{
        //there is no waiter
        if(getWaiter.length===0){

          waiting.push({'location':res, 'user':[id]});

          mcache.del('waiting');
          mcache.put('waiting', waiting);

          console.log("#########WAITING###############", mcache.get('waiting'));

          //do waiting
          let wait = doWait(res, id);

          wait.then((pal)=>{
            let reply = {
              status:'200',
              id:id,
              pal:pal,
              location:res
            };
            resolve(reply);
          }).catch((err)=>{
            console.log(err);
          });
        }else{
          //there are waiter
          getWaiter[0].user.push(id);
          waiting.map((x)=>{
            if(x.location===res){
              x=getWaiter;
            }
          });
          mcache.del('waiting');
          mcache.put('waiting', waiting);

          console.log('#########WAITING#########', mcache.get('waiting'));
          //do waiting
          let wait = doWait(res, id);

          wait.then((pal)=>{
            let reply = {
              status:'200',
              id:id,
              pal:pal,
              location:res
            };
            resolve(reply);
          }).catch((err)=>{
            console.log(err);
            let reply={
              status:'404',
              id:id,
              location:res
            };
            resolve(reply);
          });
        }
      }
    }).catch((err)=>{
      console.log(err);
      mcache.del(id);
      helper.pushMessage(id, [helper.buildText(err)]);
    });
  });
};

let getCities = (lat, long) =>{
  return new Promise((resolve, reject)=>{
    superagent.get("https://maps.googleapis.com/maps/api/geocode/json")
    .query({ key:'AIzaSyAGcD12GkxN7JafWwnkLrrRAyq9_0YqN1Q', latlng: `${lat},${long}` })
    .end(function(err, res){
      if(err) reject(err);
      let txt = JSON.parse(res.text);
      if(txt.results.length!==0){
        let region =txt.results[0].address_components.filter((x)=>{
          return x.types.indexOf('administrative_area_level_2')!==-1;
        });
        if(region.length!==0)
          resolve(region[0].long_name);
        else
          reject('Lokasi tidak ditemukan mohon ulangi sekali lagi');
      }else{
        reject('Lokasi tidak ditemukan mohon ulangi sekali lagi');
      }
    });
  });
};

let lookingForWaiter = (location) =>{
  return new Promise((resolve, reject)=>{
      let counter = 0;
      let interval = setInterval(()=>{
        if(counter<10){
          console.log('####################COUNTER############',counter);
          //check for waiter
          let waiting = mcache.get('waiting');
          let getWaiter = waiting.filter((x)=>{
            return x.location === location;
          });
          if(getWaiter.length!==0){
            if(getWaiter[0].user.length>0){
              let randNumber = Math.floor(Math.random() * getWaiter[0].user.length);
              let userId = getWaiter[0].user[randNumber];
              getWaiter[0].user.splice(randNumber,1);

              //update array
              waiting.map((x)=>{
                if(x.location===location){
                  x=getWaiter;
                }
              });

              //update cache
              mcache.del('waiting');
              mcache.put('waiting', waiting);
              mcache.del(userId);


              //update cache searcher
              let search = mcache.get('search');
              let indexSearcher=0;
              let getSearcher = search.map((x)=>{
                if(x.location === location){
                  return indexSearcher;
                }
                indexSearcher++;
              });
              search.splice(indexSearcher,1);
              mcache.del('search');
              mcache.put('search', search);
              console.log('#############FOUND#############');
              clearInterval(interval);
              resolve(userId);
          }
        }
        counter++;
        }else{
          //update search
          let search = mcache.get('search');
          let indexSearcher=0;
          let getSearcher = search.map((x)=>{
            if(x.location === location){
              return indexSearcher;
            }
            indexSearcher++;
          });
          search.splice(indexSearcher,1);
          mcache.del('search');
          mcache.put('search', search);

          let test = mcache.get("search", search);
          console.log("##########CACHESEARCH#######", test);
          clearInterval(interval);
          reject('not found');
        }
      }, 6000);
  });
};

let doWait = (location, id) =>{
  return new Promise((resolve, reject)=>{
    console.log('##########1############');
    let counter = 0;
    let interval = setInterval(()=>{
      if(counter<10){
        console.log('##########2############');

        if(!isWaiter(id, location)){
          clearInterval(interval);
          console.log('done');
        }else{
          console.log('##########3############');

          //get searcher on their location
          let search = mcache.get('search');
          let getSearcher = search.filter((x)=>{
            return x.location === location;
          });

          //if no searcher, they will be searcher
          if(getSearcher.length===0){
            //get waiter on their location
            let waiting = mcache.get('waiting');
            let getWaiter = waiting.filter((x)=>{
              return x.location === location;
            });

            let index = getWaiter[0].user.indexOf(id);
            getWaiter[0].user.splice(index,1);

            //update cache waiting
            waiting.map((x)=>{
              if(x.location===location){
                x=getWaiter;
              }
            });
            mcache.del('waiting');
            mcache.put('waiting', waiting);
            //updateCache
            search.push({'location':location, 'user':id});
            //update cache
            mcache.del('search');
            mcache.put('search', search);

            clearInterval(interval);

            let looking = lookingForWaiter(location);
            looking.then((resFromLooking)=>{
              resolve(resFromLooking);

            }).catch((err)=>{
              console.log(err);
              reject('not found');
            });

          }
        }
      counter++;
      }else{
        //update cache
        let waiting = mcache.get('waiting');
        let getWaiter = waiting.filter((x)=>{
          return x.location === location;
        });

        let index = getWaiter[0].user.indexOf(id);
        getWaiter[0].user.splice(index,1);

        //update cache waiting
        waiting.map((x)=>{
          if(x.location===location){
            x=getWaiter;
          }
        });
        mcache.del('waiting');
        mcache.put('waiting', waiting);

        clearInterval(interval);
        reject('not found');
      }
    },6000);
  });
};

let isWaiter = (id, location) =>{
  let waiting = mcache.get('waiting');
  let getWaiter = waiting.filter((x)=>{
    return x.location === location;
  });

  if(getWaiter[0].user.indexOf(id)!==-1)
    return true;
};
module.exports = {
  checkLocation:checkLocation,
  getCities:getCities
};
