var path = require('path'),
    express = require('express'),
    low = require('lowdb'),
    app = express(),   
    bodyParser = require('body-parser'),    
    Twit = require('twit');

var config = {
  twitter: {
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.ACCESS_TOKEN,
    access_token_secret: process.env.ACCESS_TOKEN_SECRET
  }
};

var twitter = new Twit(config.twitter);

var db = low('.data/db.json', { storage: require('lowdb/lib/storages/file-async') });
db.defaults({ 
  followers: [], 
  followers_last_update: 0,
  followers_history: [],
  following: [],  
  following_last_update: 0,
  following_history: [] }).write();

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get("/", function (request, response) {
  response.sendFile(__dirname + '/views/index.html');
});

app.get('/followers', function(request, response) {
  response.send(db.get('followers').value());
});

app.get('/following', function(request, response) {
  response.send(db.get('following').value());
});

app.post('/create_following_list', (request, response) => {

  if (request.body.secret != process.env.SECRET_PARAM) {
    response.status(403);
    response.send('ERROR');
    console.error('Secret: ' + request.body.secret);
    return;
  }
  var following = db.get('following').value();
  var following_ids = following.map((a) => { return a.screen_name });
  var following_count = following_ids.length;
  var following_groups = [];
  var request_max = 95;
  for (var i = 0; i < following_count; i += request_max) {
    following_groups.push(following_ids.splice(0, request_max));
  }
  
  var promise = new Promise((resolve, reject) => {
    var today = new Date().toISOString().slice(0, 10);
    var name = 'following_' + today;
    
    twitter.post('lists/create', {name: name, mode: 'private'})
      .then((result) => {
        var list_id = result.data.id_str;
        var requests = [];
        following_groups.forEach((item) => {
          var screen_names = item.join(',');
          var req = twitter.post('lists/members/create_all', {list_id: list_id, screen_name: screen_names})
            .then((result) => { console.log('added ' + list_id); console.log(screen_names); })
            .catch((err) => { console.log(err) });
          requests.push(req);
        })
        Promise.all(requests).then((result) => { resolve(result); }).catch((err) => { reject(err); });
      })
      .catch((err) => {
        reject(err);
        console.error(err);
      });
  });
  
  Promise.all([promise]).then((result) => {
    response.send('ok');
  });
  
});

// Method to fetch the latest following and followers list from Twitter.
// 
// Stores the results in a local db (lowdb).
app.post('/run', (request, response) => {
  var following = [];
  var followers = [];
  var per_page = 200;
  var user = process.env.ACCESS_USER;
  
  if (request.body.secret != process.env.SECRET_PARAM) {
    response.status(403);
    response.send('ERROR');
    console.error('Secret: ' + request.body.secret);
    return;
  }
  
  var following_promise = new Promise((resolve, reject) => {
    var pending = [];
    var request = (params) => {
      pending.push(twitter.get('friends/list', params)
        .then((result) => {
          console.log('following got result');
          var response = result.data;
          following = following.concat(response.users);
          if (response.users.length >= per_page && response.next_cursor_str) {
            request({screen_name: user, skip_status: 1, count: per_page, cursor: response.next_cursor_str});
          }

          // Ending condition.
          if (!response.next_cursor) {
            console.log('following ending cursor');
            resolve(following);
          }
        })
        .catch((err) => {
          console.error(err);      
          reject(err);
        })
      );
    };
    request({screen_name: user, count: per_page, skip_status: 1});    
  });
  
    var follower_promise = new Promise((resolve, reject) => {
    var pending = [];
    var request = (params) => {
      pending.push(twitter.get('followers/list', params)
        .then((result) => {
          console.log('followers got result');
          var response = result.data;
          followers = followers.concat(response.users);
          if (response.users.length >= per_page && response.next_cursor_str) {
            request({screen_name: user, skip_status: 1, count: per_page, cursor: response.next_cursor_str});
          }

          // Ending condition.
          if (!response.next_cursor) {
            console.log('followers ending cursor');
            resolve(followers);
          }
        })
        .catch((err) => {
          console.error(err);      
          reject(err);
        })
      );
    };
    request({screen_name: user, count: per_page, skip_status: 1});    
  });
  
  
  Promise.all([following_promise, follower_promise]).then((result) => {
    var was_followers = db.get('followers').value()
    db.get('following_history').push(
      {'timestamp': db.get('following_last_updated').value(), 
       'following': db.get('following').value()}).write();
    db.get('followers_history').push(
      {'timestamp': db.get('followers_last_updated').value(), 
       'following': db.get('followers').value()}).write();
    
    var now = Date.now();
    db.set('followers', followers).write();
    db.set('followers_last_updated', now).write();
    db.set('following', following).write();
    db.set('following_last_updated', now).write();
    
    response.send({'following': following.length, 'followers': followers.length});
    console.log('finished');
  });

});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
