/*jslint node: true */
"use strict";

var _ = require('underscore')
var async = require('async')
var model = require('../model')

module.exports = function (app) {
  app.get('/colleges', function (req, res, next) {
    var colleges = model.cache.collegesByRank
    model.Essay
      .count()
      .exec(function (err, essayCount) {
        if (err) return next(err)

        res.render('colleges', {
          colleges: colleges,
          essayCount: essayCount,
          title: 'Top ' + colleges.length + ' Colleges',
          url: '/colleges/',
          hero: {
            title: 'Best Colleges',
            tabs: [
              { name: 'All Essays', url: '/colleges/essays/' },
              { name: 'All Colleges', url: '/colleges/', on: true }
            ]
          }
        })
      })
  })

  app.get('/colleges/essays', function (req, res, next) {
    async.auto({
      essays: function (cb) {
        model.Essay
          .find()
          .populate('user college')
          .sort('-hits')
          .exec(cb)
      },
      collegeCount: function (cb) {
        model.College.count().exec(cb)
      }
    }, function (err, results) {
      if (err) return next(err)

      var tabs = [1].on = true

      res.render('essays', {
        collegeCount: results.collegeCount,
        essays: results.essays,
        title: 'College Essays - Top ' + results.essays.length + ' Essays That Worked',
        forceTitle: true,
        url: '/colleges/essays/',
        hero: {
          title: 'College Admissions Essays',
          image: 'colleges.jpg',
          tabs: [
            { name: 'All Essays', url: '/colleges/essays/', on: true },
            { name: 'All Colleges', url: '/colleges/' }
          ]
        }
      })
    })
  })

  app.get('/:collegeId', function (req, res, next) {
    var college = model.cache.colleges[req.params.collegeId]
    if (!college) return next()

    async.auto({
      essays: function (cb) {
        model.Essay
          .find({ college: college.id })
          .populate('user')
          .sort('-hits')
          .exec(cb)
      },
      populateColleges: ['essays', function (cb, results) {
        async.each(results.essays, function (essay, cb2) {
          essay.user.populate('college', cb2)
        }, cb)
      }]
    }, function (err, results) {
      var essays = results.essays
      if (err) return next(err)

      res.render('college', {
        // breadcrumbs: [ { name: 'College Essays', url: '/colleges/essays/' } ],
        college: college,
        essays: essays,
        title: 'Sample ' + college.shortName + ' Admissions Essays',
        url: college.url
      })

      college.hit()
    })
  })

  app.get('/:collegeId/about', function (req, res, next) {
    var college = model.cache.colleges[req.params.collegeId]
    if (!college) return next()

    async.auto({
      essays: function (cb) {
        model.Essay
          .find({ college: college.id })
          .select('-body -prompt')
          .sort('-hits')
          .exec(cb)
      }
    }, function (err, results) {
      var essays = results.essays
      if (err) return next(err)

      res.render('college-about', {
        breadcrumbs: [ { name: 'College Essays', url: '/colleges/essays/' } ],
        college: college,
        essays: essays,
        title: 'About ' + college.name,
        url: college.url + 'about/'
      })

      college.hit()
    })
  })
}