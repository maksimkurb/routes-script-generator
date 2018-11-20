// Author: Ilya Ig. Petrov, ilyaigpetrov@gmail.com, 2017
'use strict';

const fs = require('fs');
const Xml2Js = require('xml2js');
const Logger = require('./logger');
const Utils = require('./utils');
const Generator = require('./generator');

function strToDate(str) {

  // 2016-12-29 14:00:00 +0000 -> 2016/12/29 14:00:00 +0000
  return new Date( str.replace(/-/, '/').replace(/-/, '/') );

}

async function ifShouldUpdateFromSourcesAsync(lastFetchDate) {
  // The CVS file is about 7MB in size. Instead of downloading it every 2h we may check first if it was updated.
  // Unfortuntely GoogleScript doesn't allow to make HEAD requests so we have to use RSS feeds for checking.
  Logger.log('LAST FETCH DATE: ' + lastFetchDate);

  var blockProviders = [
    {
      urls: [
        'http://sourceforge.net/p/z-i/code-0/HEAD/tree/dump.csv?format=raw',
        'https://svn.code.sf.net/p/z-i/code-0/dump.csv'
      ],
      //rss: 'http://sourceforge.net/p/z-i/activity/feed?source=project_activity', // Still works.
      rss: 'https://sourceforge.net/p/z-i/code-0/feed',
      /* RSS update date:
      updateElementPath: ['channel', 'lastBuildDate']
      */
      updateElementPath: ['channel', 0, 'item', 0, 'title', 0] // Updated: 2016-12-29 14:00:00 +0000
    },
    {
      urls: ['https://raw.githubusercontent.com/zapret-info/z-i/master/dump.csv'],
      rss: 'https://github.com/zapret-info/z-i/commits/master.atom',
      /* RSS update date:
      updateElementPath: ['updated'],
      dateFormat: 'ISO 8601'
      if (provider.dateFormat === 'ISO 8601') {
        // Google Script can't handle this format.
        // 2016-01-06T14:44:10+01:00 -> 2016/01/06 14:44:10 +01:00
        dateString = dateString.replace(/-/,'/').replace(/-/,'/').replace(/T/,' ').replace(/\+/,' \+').replace('-', ' -').replace(/Z/,' +00');
      }
      */
      updateElementPath: ['entry', 0, 'title', 0], // Updated: 2016-12-29 14:00:00 +0000
    },
    {
      urls: ['https://www.assembla.com/spaces/z-i/git/source/master/dump.csv?_format=raw'],
      rss: 'https://app.assembla.com/spaces/z-i/stream.rss',
      updateElementPath: ['channel', 0, 'item', 1, 'title', 0] // Changeset [f3a5b94023f]: Updated: 2016-12-29 14:00:00 +0000 Branch: master
    }
  ];

  const urlsObjects = [];
  do {
    var provider = blockProviders.shift();
    try {
      if ( provider.rss && provider.updateElementPath ) {
        var res = await Utils.fetch(provider.rss);
        if ( res.ifOk ) {
          var xml = res.content;
          var [err, document] = await new Promise((resolve) => Xml2Js.parseString(
            xml,
            {
              explicitRoot: false,
              trim: true,
            },
            (...args) => resolve(args),
          ));
          if (err) {
            throw err;
          }
          var parent = document;
          var element;
          do {
            element = provider.updateElementPath.shift()
            parent = parent[element];
          } while(provider.updateElementPath.length);
          const title = parent;
          const groups = /Updated:\s+(\d\d\d\d-\d\d-\d\d\s+\d\d:\d\d:\d\d\s+[+-]\d\d\d\d)/.exec(title);
          var dateString = groups && groups[1];
          Logger.log(provider.urls[0] + ' ' + dateString);
          if (!dateString) {
            continue;
          }
          if ( !lastFetchDate || strToDate( dateString ) > strToDate( lastFetchDate )) {
            urlsObjects.push({
              urls: provider.urls,
              date: strToDate(dateString),
              dateString: dateString
            });
          }
        }
      }
    } catch(err) {
      continue;
    }
  } while(blockProviders.length);
  if (urlsObjects.length) {
    return urlsObjects.sort( function(a, b) { return b.date - a.date; } );
  }
  return false;

}

function forceUpdatePacScriptAsync() {

  updatePacScriptAsync(true);

}

async function updatePacScriptAsync(ifForced) {

  var start = new Date();

  const sources = await ifShouldUpdateFromSourcesAsync();
  if (!sources) {
    Logger.log('Too early to update. New version is not ready.');
    return;
  }

  var result = await Generator.generatePacScriptAsync(sources);
  if (result.error) {
    throw result.error;
  }
  const batData = result.content;

  Logger.log('PAC script generated. Saving...');

  fs.writeFile('./generated.bat', batData, (err) => {
    if (err) {
      console.error(err);
    }

    Logger.log('TIME:' + (new Date() - start));
  });
}

function testPunycode() {

  Logger.log( punycode.toASCII('www.76автобар.рф') );

}

module.exports = {
  updatePacScriptAsync,
};
