'use strict';

// Imports modules
const express = require('express');
const morgan = require('morgan');
const { Sequelize } = require('sequelize');
const sequelize = require('./models').sequelize;
const config = require('./config/config.json')
const { User, Course } = require('./models');
const bcrypt = require('bcryptjs');
const auth = require('basic-auth');

// Enables global error logging
const enableGlobalErrorLogging = process.env.ENABLE_GLOBAL_ERROR_LOGGING === 'true';

// Creates the Express app
const app = express();

// Morgan for http request logging
app.use(morgan('dev'));

// JSON parsing for request bodies
app.use(express.json());

// Middleware to authenticate the user
const authenticateUser = async (req, res, next) => {
  let message;
  // Parses the user's credentials from the Authorization header
  const credentials = auth(req);

  if (credentials) {
    const user = await User.findOne({ where: { emailAddress: credentials.name } });

    if (user) {
      const authenticated = bcrypt.compareSync(credentials.pass, user.password);

      if (authenticated) {
        console.log(`Authentication successful for username: ${user.emailAddress}`);
        req.currentUser = user;
        return next();
      } else {
        message = `Authentication failure for username: ${user.emailAddress}`;
      }
    } else {
      message = `User not found for username: ${credentials.name}`;
    }
  } else {
    message = 'Auth header not found';
  }

  console.warn(message);

  res.status(401).json({ message: 'Access Denied' });
};

/*
  * Home Route
*/
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to the REST API project!',
  });
});

/*
  * Users Routes
*/
// Returns all properties and values for the currently authenticated User
app.get('/api/users', authenticateUser, async (req, res) => {
  try {
    const user = req.currentUser;
    const authenticatedUser = await User.findByPk(user.id, {
      attributes: ['id', 'firstName', 'lastName', 'emailAddress'],
    });

    if (authenticatedUser) {
      res.status(200).json(authenticatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Creates a new user
app.post('/api/users', async (req, res) => {
  try {
    const newUser = await User.create(req.body);
    res.status(201).location('/').end();
  } catch (error) {
    if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
      const errors = error.errors.map(err => err.message);
      res.status(400).json({ errors });
    } else {
    console.error('Error creating user:', error);
    res.status(400).json({ message: 'Error creating user'});
    }
  }
});

/*
  * Courses Routes
*/
// Returns all courses
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.findAll({
      attributes: ['id', 'title', 'description', 'estimatedTime', 'materialsNeeded'],
      include: {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'emailAddress']
      }
    });
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Returns the corresponding course
app.get('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findByPk(req.params.id, {
      attributes: ['id', 'title', 'description', 'estimatedTime', 'materialsNeeded'],
      include: {
        model: User,
        as: 'user',
        attributes: ['id', 'firstName', 'lastName', 'emailAddress']
      }
    });

    if (course) {
      res.status(200).json(course);
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  } catch (error) {
    console.error('Error fetching course', error);
    res.status(500).json({ message: 'Internal server error'});
  }
});

// Creates a new course
app.post('/api/courses', authenticateUser, async (req, res) => {
  try {
    const user = req.currentUser;
    const newCourse = await Course.create({ ...req.body, userId: user.id });
    res.status(201).location(`/api/courses/${newCourse.id}`).end();
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      res.status(400).json({ errors });
    } else {
      console.error('Error creating course', error);
      res.status(400).json({ message: 'Error creating course' });
    }
  }
});

// Updates the corresponding course
app.put('/api/courses/:id', authenticateUser, async (req, res) => {
  try {
    const user = req.currentUser;
    const course = await Course.findByPk(req.params.id);

    if (course) {
      if (course.userId === user.id) {
        await course.update(req.body);
        res.status(204).end();
      } else {
      res.status(403).json({ message: 'Forbidden: You can only update your own courses' });
      }
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  } catch (error) {
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      res.status(400).json({ errors });
    } else {
      console.error('Error updating course:', error);
      res.status(400).json({ message: 'Error updating course' });
    }
  }
});

// Deletes the corresponding course
app.delete('/api/courses/:id', authenticateUser, async (req, res) => {
  try {
    const user = req.currentUser;
    const course = await Course.findByPk(req.params.id);

    if (course) {
      if (course.userId === user.id) {
        await course.destroy();
        res.status(204).end();
       } else {
        res.status(403).json({ message: 'Forbidden: You can only delete your own courses' });
      }
    } else {
      res.status(404).json({ message: 'Course not found' });
    }
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Sends a 404 error if no other route matches
app.use((req, res) => {
  res.status(404).json({
    message: 'Route Not Found',
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (enableGlobalErrorLogging) {
    console.error(`Global error handler: ${JSON.stringify(err.stack)}`);
  }

  res.status(err.status || 500).json({
    message: err.message,
    error: {},
  });
});

// Tests the database connection
sequelize.authenticate()
  .then(() => {
    console.log('Connection to the database has been established successfully.');
  })
  .catch(err => {
    console.error('Unable to connect to the database:', err);
  });

// Port setup
app.set('port', process.env.PORT || 5000);

// Starts listening on the port
const server = app.listen(app.get('port'), () => {
  console.log(`Express server is listening on port ${server.address().port}`);
});
