import { Console } from 'console';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);

// Configuración de Socket.io con CORS para tu dominio de Yii2
const io = new Server(httpServer, {
    cors: {
        origin: "*", // En producción, cámbialo por tu dominio real
        methods: ["GET", "POST"]
    }
});

app.use(express.json());

app.get('/', (req, res) => {
    console.log('Servidor ESM para notificaciones de informes iniciado');
    res.send('Servidor ESM para notificaciones de informes');
});
// Endpoint para que el Job de PHP envíe la notificación
app.post('/notify-job-complete', (req, res) => {
    const { usuario_id, mensaje, url } = req.body;

    if (!usuario_id || !url) {
        return res.status(400).json({ error: 'Faltan datos obligatorios' });
    }

    // Emitir el evento a la sala privada del usuario
    io.to(`user_${usuario_id}`).emit('informe-listo', {
        mensaje: mensaje || 'Tu informe está listo',
        url: url
    });

    console.log(`Notificación enviada al usuario ${usuario_id}`);
    return res.status(200).json({ success: true });
});

// Manejo de conexiones de clientes (Navegador)
io.on('connection', (socket) => {
    socket.on('join', (userId) => {
        if (userId) {
            socket.join(`user_${userId}`);
            console.log(`Cliente unido a sala: user_${userId}`);
        }
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Servidor ESM corriendo en http://localhost:${PORT}`);
});