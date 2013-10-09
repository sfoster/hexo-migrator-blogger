var extend = hexo.extend,
  util = hexo.util,
  file = util.file,
  path = require('path'),
  sourceDir = hexo.source_dir,
  xml2js = require('xml2js'),
  parser = new xml2js.Parser(),
  request = require('request'),
  async = require('async'),
  tomd = require('to-markdown').toMarkdown;
  isObject = function(thing) {
    return (thing && 'object' == typeof thing);
  };

extend.migrator.register('blogger', function(args){
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
      // just get the posts, ditch all the template, settings junk
      // also excluding comments for now
      var entries = data.feed.entry.filter(function(entry){
        if(!entry.content) {
          return false;
        }
        var term = (
          entry.category && entry.category[0] &&
          entry.category[0]['$'] && entry.category[0]['$'].term
        );
        if(term) {
          return term.match(/kind#post$/);
        }
        return true;
      });

      var dataFilename = (source.replace(/[\\\/]$/).split(/[\\\/]/)).pop();
      dataFilename = dataFilename.replace(/\.[a-z]+/, '');
      file.write(sourceDir + dataFilename + '.json', JSON.stringify(entries, null, 2), next);

      var length = 0;

      // each post
      function entryValue(entry, which) {
        var value = entry[which][0];
        if('object' == typeof value)
          return value['_'];
        else
          return value;
      }

      async.forEach(entries, function(item, next){
        var id = entryValue(item, 'id');
        var _postLink  =  (item.link.filter(function(lnk){
          return lnk['$'].type == "text/html" &&
                 lnk['$'].rel == "alternate";
        }))[0];
        var postLink = _postLink['$'].href
                            .substring(_postLink['$'].href.lastIndexOf('/')+1)
                            .replace(/\.html$/, '');
        console.log("postLink: "+postLink);
        var postType = item.content[0] && item.content[0]['$'] && item.content[0]['$'].type;
        var postTitle = entryValue(item, 'title');
        var postDate =  entryValue(item, 'published');
        var postContent = entryValue(item, 'content');
        if('html' == postType) {
          postContent = postContent.split('\n').map(function(line){
            return line.trim();
          }).join('\n');
        }
        if(!postTitle || (/^\s+$/).test(postTitle)) {
          console.log("No postTitle, trying from content, postType is:" + postType);
          postTitle = (postType == 'html') ? postContent.replace(/<\/?[^>]+>/g, '') :
                                           postContent;
          postTitle = postTitle.trim()
                               .split(/\n|\\n/)[0]
                               .trim()
                               .replace(/[\-]{2,}/g, '--');
        }
        console.log("postTitle: " + postTitle);

        var postComment = null;
        var postStatus = '_posts';
        var postTag, categories = null;

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
            var filename = sourceDir + path.join(postStatus, decodeURIComponent(postLink) + '.md');
            console.log("Creating post at: "+filename);
            length++;
            file.write(filename, content.join('\n') + '\n\n' + postContent, next);
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
