$(function() {
  
  $.get('/following', (user) => {
    user.forEach(function(user) {
      var tr = $('<tr></tr>');
      tr.append($('<td></td>').text(user.screen_name));
      tr.append($('<td></td>').text(user.lang));
      tr.append($('<td></td>').text(user.friends_count));
      tr.append($('<td></td>').text(user.followers_count));
      tr.appendTo('table#users');
    })
  });

  $('#createlist').click((event) => {
    var secret = $('#secret').val();
    
    $.post('/create_following_list', {secret: secret}, function(response) {
      $('#result').text(response);
    });
  })
  
    $('#run').click((event) => {
    var secret = $('#secret').val();
    
    $.post('/run', {secret: secret}, function(response) {
      $('#result').text(response);
    });
  })
 

});
