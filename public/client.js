$(function() {
  
  $.get('/following', (user) => {
    user.forEach(function(user) {
      $('<li></li>')
        .text(
          user.screen_name + 
          ' (' + user.lang + ') ' +
          ' (' + user.friends_count + ', ' + user.followers_count + ')')
        .appendTo('ul#followers');
    })
  });

  $('form').submit(function(event) {
    event.preventDefault();
    var name = $('input').val();
    
    $.post('/create_following_list', {name: name}, function(response) {
      console.log(response);
    });
  });

});
