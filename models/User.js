'use strict';

const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');

module.exports = (sequelize) => {
  class User extends Model {
    // Define associations
    static associate(models) {
      // Defines a one-to-many association with Course model
      User.hasMany(models.Course, {
        as: 'couses',
        foreignkey: 'userId',
      });
    }
  }

  User.init({
    // Defines the fields for the User model
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'First name is required'
        },
        notEmpty: {
          msg: 'Please provide a first name'
        }
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Last name is required'
        },
        notEmpty: {
          msg: 'Please provide a last name'
        }
      }
    },
    emailAddress: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        args: true,
        msg: 'Email address already in use'
      },
      validate: {
        notNull: {
          msg: 'Email address is required'
        },
        isEmail: {
          msg: 'Please provide a valid email address'
        }
      }
    },
    password: {
      type: DataTypes.VIRTUAL,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Password is required'
        },
        notEmpty: {
          msg: 'Please provide a password'
        }
      }
    },
    confirmedPassword: {
      type: DataTypes.STRING,
      allowNull: false,
      set(val) {
        if (val === this.password) {
          const hashedPassword = bcrypt.hashSync(val, 10);
          this.setDataValue('confirmedPassword', hashedPassword);
        }
      },
      validate: {
        notNull: {
          msg: 'Both passwords must match'
        }
      }
    }
  }, {
    sequelize,
    modelName: 'User',
  });

  return User;
};
