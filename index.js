var extend = hexo.extend,
  util = hexo.util,
  file = util.file,
  sourceDir = hexo.source_dir,
  xml2js = require('xml2js'),
  parser = new xml2js.Parser(),
  request = require('request'),
  async = require('async'),
  tomd = require('to-markdown').toMarkdown;
  isObject = function(thing) {
    return (thing && 'object' == typeof thing);
  }

extend.migrator.register('wordpress', function(args){
  var source = args._.shift();

  if (!source) return console.log('\nUsage: hexo migrate blogger <source>');

  async.waterfall([
    function(next){
      console.log('Fetching %s.', source);

      // URL regular expression from: http://blog.mattheworiordan.com/post/13174566389/url-regular-expression-for-links-with-or-without-the
      if (source.match(/((([A-Za-z]{3,9}:(?:\/\/)?)(?:[-;:&=\+\$,\w]+@)?[A-Za-z0-9.-]+|(?:www.|[-;:&=\+\$,\w]+@)[A-Za-z0-9.-]+)((?:\/[\+~%\/.\w-_]*)?\??(?:[-\+=&;%@.\w_]*)#?(?:[.\!\/\\w]*))?)/)){
        request(source, function(err, res, body){
          if (err) throw err;
          if (res.statusCode == 200) next(null, body);
        });
      } else {
        file.read(source, next);
      }
    },
    function(data, next){
      console.log('Parsing XML.');
      parser.parseString(data, next);
    },
    function(data, next){
      console.log('Analyzing.');

      file.write(sourceDir + 'posts.json', JSON.stringify(data, null, 2), next);

      var length = 0,
        arr = []; // data.rss.channel[0].item;

      // each post
      async.forEach(arr, function(item, next){
        // postTitle
        // postDate
        // postLink
        // postContent
        // postComment
        // postStatus
        // postTags or categories

        var type = 'post'; // post||page,
        switch (type){
          case 'post':

            var content = [
              'title: "' + postTitle.replace(/"/g, '\\"') + '"',
              'id: ' + id,
              'date: ' + postDate,
              'tags: ' + (postTag ? postTag : ''),
              'categories: ' + (categories || 'uncategory'),
              '---'
            ];

            file.write(sourceDir + postStatus + decodeURIComponent(postLink) + '.md', content.join('\n') + '\n\n' + postContent, next);
            break;

          case 'page':
            length++;

            var content = [
              'title: ' + postTitle,
              'date: ' + postDate,
              '---'
            ];

            file.write(sourceDir + postLink + '/index.md', content.join('\n') + '\n\n' + postContent, next);
            break;

          default:
            next();
        }
      }, function(err){
        if (err) throw err;
        next(null, length);
      });
    }
  ], function(err, length){
    if (err) throw err;
    console.log('%d posts migrated.', length);
  });
});
