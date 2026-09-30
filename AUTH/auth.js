const express = require('express');
const path = require('path');
const router = express.Router();
const authController = require('./authController');

//Mostrar formulario de login
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../views/login.html'));
});

//Procesar login
router.post('/login', authController.login);

//Logout
router.get('/logout', authController.logout);

module.exports = router;