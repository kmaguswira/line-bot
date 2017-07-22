module.exports = {
  commandUser:['#yuk-jalan','#lokasi','#hotel','#event','#cuaca','#kuliner','#menu', '#feedback', '#about'],
  commandGroup:['#yuk-jalan','#lokasi','#hotel','#event','#cuaca','#kuliner','#menu', "#bye", '#feedback', '#about'],
  commandCache: ()=>{
    return [
        {
          'name' : '#lokasi',
          'displayName': null,
          'location' : null,
          'latlong': null
        },
        {
          'name' : '#hotel',
          'displayName': null,
          'location' : null,
          'latlong': null
        },
        {
          'name' : '#event',
          'displayName': null,
          'location': null,
          'latlong' : null
        },
        {
          'name' : '#kuliner',
          'displayName': null,
          'latlong' : null,
          'type' : null
        },
        {
          'name' : '#cuaca',
          'displayName': null,
          'latlong' : null,
          'type' : null
        },
        {
          'name' : '#menu',
          'displayName':null
        },
        {
          'name' : '#yuk-jalan',
          'displayName':null,
          'latlong':null
        },
        {
          'name' : '#bye',
          'displayName':null
        },
        {
          'name' : '#feedback',
          'displayName':null
        },
        {
          'name' : '#about',
          'displayName':null
        }
      ];
  },
  commandSentence:()=>{
    return [
      {
        'word': 'lokasi',
        'command': '#lokasi'
      },
      {
        'word': 'hotel',
        'command': '#hotel'
      },
      {
        'word': 'akomodasi',
        'command': '#hotel'
      },
      {
        'word': 'acara',
        'command': '#event'
      },
      {
        'word': 'acara',
        'command': '#event'
      },
      {
        'word': 'event',
        'command': '#event'
      },
      {
        'word': 'makan',
        'command': '#kuliner'
      },
      {
        'word': 'kuliner',
        'command': '#kuliner'
      },
      {
        'word': 'cuaca',
        'command': '#cuaca'
      },
      {
        'word': 'feedback',
        'command': '#feedback'
      },
      {
        'word': 'saran',
        'command': '#feedback'
      },
      {
        'word': 'teman',
        'command': '#yuk-jalan'
      },
      {
        'word': 'temen',
        'command': '#yuk-jalan'
      },
      {
        'word': 'menu',
        'command': '#menu'
      },
      {
        'word': 'fitur',
        'command': '#menu'
      }
    ];
  }
};
