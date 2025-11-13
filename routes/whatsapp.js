const express = require('express');
const twilio = require('twilio');
const db = require('../database/db');
const router = express.Router();


const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

router.post('/', (req, res) => {
  const { From, Body } = req.body;
  const message = Body.toLowerCase().trim();
  const phoneNumber = From.replace('whatsapp:', '');

  db.get('SELECT * FROM workers WHERE phone = ?', [phoneNumber], (err, worker) => {
    if (!worker && message !== 'registrar') {
      sendWhatsAppMessage(From, '¡Hola! 👋 Para registrarte...');
      return res.sendStatus(200); // ✅ returns here, so nothing else runs
    }

    // Handle commands
    if (message === 'registrar') {
      handleRegistration(From, phoneNumber);
      return res.sendStatus(200);
    } 
    if (message === 'ayuda' || message === 'help') {
      sendHelpMenu(From);
      return res.sendStatus(200);
    }
    if (message === 'trabajos' || message === 'jobs') {
      sendAvailableJobs(From, worker);
      return res.sendStatus(200);
    }
    if (message.startsWith('aceptar')) {
      const jobId = message.split(' ')[1];
      acceptJob(From, worker, jobId);
      return res.sendStatus(200);
    }
    if (message === 'parar' || message === 'stop') {
      unsubscribe(From, phoneNumber);
      return res.sendStatus(200);
    }
    if (message.startsWith('nombre:')) {
      updateName(From, phoneNumber, Body.substring(7).trim());
      return res.sendStatus(200);
    }
    if (message.startsWith('ubicacion:')) {
      updateLocation(From, phoneNumber, Body.substring(10).trim());
      return res.sendStatus(200);
    }

    // default help
    sendHelpMenu(From);
    return res.sendStatus(200);
  });
});


function sendWhatsAppMessage(to, message) {
  return client.messages.create({
    body: message,
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: to
  });
}

function handleRegistration(phoneNumber, cleanNumber) {
  db.get('SELECT * FROM workers WHERE phone = ?', [cleanNumber], (err, worker) => {
    if (worker) {
      sendWhatsAppMessage(phoneNumber, 
        '✅ Ya estás registrado!\n\nPuedes actualizar tu información:\n' +
        '📝 Envía "NOMBRE: tu nombre"\n' +
        '📍 Envía "UBICACION: tu ubicación"');
    } else {
      db.run('INSERT INTO workers (phone) VALUES (?)', [cleanNumber], function(err) {
        if (!err) {
          sendWhatsAppMessage(phoneNumber,
            '🎉 ¡Registro exitoso!\n\n' +
            'Por favor completa tu perfil:\n' +
            '📝 Envía "NOMBRE: tu nombre"\n' +
            '📍 Envía "UBICACION: tu ubicación"\n\n' +
            'Envía "AYUDA" para ver todos los comandos.');
        }
      });
    }
  });
}

function sendHelpMenu(phoneNumber) {
  const helpMessage = 
    '📋 *MENÚ DE AYUDA*\n\n' +
    '📝 *NOMBRE:* tu nombre - Actualizar nombre\n' +
    '📍 *UBICACION:* tu ubicación - Actualizar ubicación\n' +
    '💼 *TRABAJOS* - Ver trabajos disponibles\n' +
    '✅ *ACEPTAR* [número] - Aceptar un trabajo\n' +
    '🛑 *PARAR* - Dejar de recibir mensajes\n' +
    '❓ *AYUDA* - Ver este menú';
  
  sendWhatsAppMessage(phoneNumber, helpMessage);
}

function sendAvailableJobs(phoneNumber, worker) {
  db.all(
    'SELECT * FROM jobs WHERE active = 1 AND date >= date("now")',
    [],
    (err, jobs) => {
      if (err || jobs.length === 0) {
        sendWhatsAppMessage(phoneNumber, '📭 No hay trabajos disponibles en este momento.');
        return;
      }

      let message = '💼 *TRABAJOS DISPONIBLES*\n\n';
      jobs.forEach((job, index) => {
        message += `*#${job.id}* - ${job.title}\n`;
        message += `📍 ${job.location}\n`;
        message += `💰 $${job.pay_rate} ${job.pay_type}\n`;
        message += `📅 ${job.date}\n`;
        message += job.transport_provided ? '🚌 Transporte incluido\n' : '';
        message += `⏱️ ${job.duration}\n`;
        message += '---\n';
      });
      message += '\nPara aceptar, envía: ACEPTAR [número]';
      
      sendWhatsAppMessage(phoneNumber, message);
    }
  );
}

function acceptJob(phoneNumber, worker, jobId) {
  if (!jobId) {
    sendWhatsAppMessage(phoneNumber, '❌ Por favor especifica el número del trabajo. Ejemplo: ACEPTAR 5');
    return;
  }

  db.run(
    'INSERT INTO applications (worker_id, job_id, status) VALUES (?, ?, ?)',
    [worker.id, jobId, 'accepted'],
    function(err) {
      if (err) {
        sendWhatsAppMessage(phoneNumber, '❌ Error al aceptar el trabajo. Intenta de nuevo.');
      } else {
        sendWhatsAppMessage(phoneNumber, 
          `✅ ¡Trabajo #${jobId} aceptado!\n\n` +
          'El empleador será notificado. Te contactarán pronto con más detalles.');
      }
    }
  );
}

function updateName(phoneNumber, cleanNumber, name) {
  db.run('UPDATE workers SET name = ? WHERE phone = ?', [name, cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, `✅ Nombre actualizado a: ${name}`);
    }
  });
}

function updateLocation(phoneNumber, cleanNumber, location) {
  db.run('UPDATE workers SET location = ? WHERE phone = ?', [location, cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, `✅ Ubicación actualizada a: ${location}`);
    }
  });
}

function unsubscribe(phoneNumber, cleanNumber) {
  db.run('UPDATE workers SET active = 0 WHERE phone = ?', [cleanNumber], (err) => {
    if (!err) {
      sendWhatsAppMessage(phoneNumber, 
        '👋 Has sido dado de baja del sistema.\n' +
        'Para volver a registrarte, envía "REGISTRAR"');
    }
  });
}

// Function to send job notifications (called from jobs.js)
async function sendJobToWorkers(job) {
  db.all('SELECT * FROM workers WHERE active = 1', [], (err, workers) => {
    if (err) return;
    
    const message = 
      `🆕 *NUEVO TRABAJO DISPONIBLE*\n\n` +
      `*${job.title}*\n` +
      `📍 ${job.location}\n` +
      `💰 $${job.pay_rate} ${job.pay_type}\n` +
      `📅 ${job.date}\n` +
      (job.transport_provided ? '🚌 Transporte incluido\n' : '') +
      `⏱️ ${job.duration}\n\n` +
      `Para aceptar, envía: ACEPTAR ${job.id}`;
    
    workers.forEach(worker => {
      sendWhatsAppMessage(`whatsapp:${worker.phone}`, message);
    });
  });
}

module.exports = router;
module.exports.sendJobToWorkers = sendJobToWorkers;