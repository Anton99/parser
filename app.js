var cheerio = require('cheerio');
var request = require('request');
var async = require('async');

var config = require('./config');

var results = [];
var currentSystem = "";

var categoryNumber = 0;
var productNumber = 0;

var uniqueLinks = [];

function getLinks(url, linksNext) {
    console.log("OPEN CATEGORY #" + ++categoryNumber + ": ", url);
    request(url + '&limit=1000', function (err, res, body) {
        if (err) {
            console.log("ERROR: ", err);
        }
        var $ = cheerio.load(body);
        var items = $(config[currentSystem].category);
        var isProducts = items.length == 0;
        items = items.length > 0 ? items : $(config[currentSystem].products);

        var urls = [];

        for (var i = 0; i < items.length; i++) {
            var url = $(items[i]).attr('href');
            urls.push(url);
        }
        if (isProducts) {
            async.mapLimit(urls, 3, getProductDetails,
                function (err, results) {
                    linksNext(err, results);
                })
        }
        else {
            async.mapLimit(urls, 3, getLinks,
                function (err, results) {
                    linksNext(err, results);
                })
        }
    });
}

function getProductDetails(productUrl, next) {
    var self = this;

    var index = uniqueLinks.indexOf(productUrl);
    if (index == -1) {
        uniqueLinks.push(productUrl)
    }
    else console.log("DANGER, THIS LINKS REQUESTED AGAIN: ", uniqueLinks[index]);

    console.log("OPEN PRODUCT #:" + ++productNumber + ": ", productUrl);
    self.url = productUrl;
    request(productUrl, function (err, res, body) {
        if (err) {
            console.log("ERROR: ", err);
        }

        var $ = cheerio.load(body);
        if ($('title').text().indexOf('503 Service') > -1) {
            console.log('503 error: ', self.url);
        }
        var obj = {
            name: $(config[currentSystem].product.name).text(),
            code: $(config[currentSystem].product.code).text(),
            img: $(config[currentSystem].product.img).attr('href'),
            descr: $(config[currentSystem].product.descr).text(),
            price: $(config[currentSystem].product.price).text(),
            isAvailable: $(config[currentSystem].product.isAvailable).length > 0
        }
        results.push(obj);
        next(err, obj);
    });
}

function parse(systemName, cb) {
    currentSystem = systemName;
    console.log("OPEN ROOT: ", config[currentSystem].url);
    request(config[currentSystem].url, function (err, res, body) {
        var texnanoCategories = []

        var $ = cheerio.load(body);
        var categories = $(config[currentSystem].category);

        var urls = [];
        for (var i = 0; i < categories.length; i++) {
            var name = $(categories[i]).find('span').text();
            var url = $(categories[i]).attr('href');
            urls.push(url);
            var new_name = name.substring(
                0, name.indexOf('(') - 1
            )
            var count = name.substring(name.indexOf('(') + 1, name.indexOf(')'));
            var obj = {
                name: new_name,
                url: url,
                itemsCount: count
            };
            texnanoCategories.push(obj);
        }
        async.mapLimit(urls, 3, getLinks, function (err, res) {
            cb(results);
        })
    });
}

/*parse('texnano', function(res){
 console.log(res);
 });*/

module.exports = parse;