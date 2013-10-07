/*jslint node: true */
"use strict";

var _ = require('underscore')
var async = require('async')
var auth = require('../auth')
var bcrpyt = require('bcrypt')
var email = require('../lib/email')
var model = require('../model')

module.exports = function (app) {
  app.get('/signup', auth.returnTo, function (req, res) {
    if (req.user) {
      res.redirect('/submit/essay/')
    } else {
      res.render('signup', {
        errors: req.flash('error'),
        user: req.flash('user')[0]
      })
    }
  })

  app.post('/signup', function (req, res, next) {
    var college = model.cache.colleges[req.body.college]
    var user = new model.User({
      name: req.body.name,
      email: req.body.email,
      password: req.body.password,
      college: college && college._id,
      collegeMajor: req.body.collegeMajor,
      collegeYear: req.body.collegeYear
    })
    user.save(function (err) {
      if (err && err.code === 11000) {
        req.flash('error', 'A user is already using that email address.')
        req.flash('user', req.body)
        res.redirect('/signup/')
      } else if (err && err.name === 'ValidationError') {
        _(err.errors).map(function (error) {
          req.flash('error', error.type)
        })
        req.flash('user', req.body)
        res.redirect('/signup/')
      } else if (err) {
        next(err)
      } else {
        // Automatically login the user
        req.login(user, function (err) {
          if (err) return next(err)

          if (req.session && req.session.returnTo) {
            var url = req.session.returnTo
            delete req.session.returnTo
            res.redirect(url)
          } else {
            res.redirect('/signup/')
          }
          email.notifyAdmin('New user', user)
        })
      }
    })
  })
}

// TODO: add users to Mailchimp
// module.exports = function () {
//   app.post('/subscribe', function (req, res) {
//     try {
//       var api = new MailChimpAPI(secret.mailchimp.key, { version : '2.0' })
//     } catch (e) {
//       console.error(e)
//     }

//     var email = req.body.email

//     api.call('lists', 'subscribe', {
//       email: { email: email },
//       id: secret.mailchimp.listId
//     }, function (err, data) {
//       if (err) {
//         console.error(err)
//         res.send({ status: 'error' })
//       } else {
//         res.send({ status: 'ok' })
//       }
//     })
//   })
// }