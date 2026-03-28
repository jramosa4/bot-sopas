const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// --- CONFIGURACIÓN DE LA NUBE ---
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    }
});

// --- CONFIGURACIÓN DEL NEGOCIO ---
const ID_GRUPO_COCINA = '120363425134101856@g.us'; 
const TIEMPO_EXPIRACION = 60 * 60 * 1000; // 1 hora de memoria

const estadoUsuarios = {};
const datosPedido = {};
const ultimoMensaje = {};

client.on('qr', (qr) => {
    // Esto genera un QR más pequeño y compatible
    qrcode.generate(qr, { small: true });
    console.log('¡ESCANEAME AHORA!');
});

client.on('ready', () => {
    console.log('¡Sopitas del Campo está EN VIVO desde la nube! ☁️🍲');
});

client.on('message', async msg => {
    const numero = msg.from;
    const texto = msg.body.toLowerCase().trim();
    const ahora = Date.now();

    // LÓGICA DE TIEMPO (1 HORA)
    if (estadoUsuarios[numero] && ultimoMensaje[numero]) {
        const tiempoPasado = ahora - ultimoMensaje[numero];
        if (tiempoPasado > TIEMPO_EXPIRACION && estadoUsuarios[numero] !== 'finalizado') {
            delete estadoUsuarios[numero];
            delete datosPedido[numero];
        }
    }
    ultimoMensaje[numero] = ahora;

    if (texto === '!id') return msg.reply(`El ID es: ${numero}`);

    const menuDiario = JSON.parse(fs.readFileSync('menu.json', 'utf8'));
    const precioBase = parseInt(menuDiario.precio.replace('.', ''));

    // --- SALUDO / REINICIO ---
    if (texto === 'hola' || texto === 'menu' || texto === 'menú' || !estadoUsuarios[numero]) {
        estadoUsuarios[numero] = 'inicio';
        datosPedido[numero] = {
            carrito: [], 
            sopaActual: '',
            cantidadSopasTotal: 0,
            adicionales: [], 
            extraPendiente: '',
            tipoEntrega: '',
            nombre: '',
            direccion: ''
        };
        
        return msg.reply(`¿Qué más, veci? Bienvenido a *Sopitas del Campo* 🍲. Aquí le tenemos la sopita para el alma (y pal' hambre).\n\nResponda con el *número* de la opción que busca:\n1️⃣ Pedir la sopita de hoy\n2️⃣ Ubicación y envíos\n3️⃣ Preguntas frecuentes`);
    }

    // --- FLUJO DE PEDIDO ---
    if (estadoUsuarios[numero] === 'inicio') {
        if (texto === '1') {
            estadoUsuarios[numero] = 'eligiendo_cantidad_sopas';
            return msg.reply(`Digite la cantidad de sopas que desea para hoy:`);
        } 
        else if (texto === '2') {
            return msg.reply(`📍 *Punto de entrega:* Nos movemos todos los días. ¡Pregúntenos dónde estamos hoy!\n\n🛵 *Domicilios:* Sin costo adicional solo en los alrededores del punto de entrega.\n\nEscriba *menu* para volver.`);
        } 
        else if (texto === '3') {
            return msg.reply(`🤔 *FAQ:*\n*Horario:* Lun a Vie, 11am - 4pm.\n*Extras:* Sí, a $2.000 c/u.\n*Pagos:* Efectivo, Nequi y Daviplata.\n\nEscriba *menu* para volver.`);
        } else return msg.reply('Responda con 1, 2 o 3, veci. 🙏');
    }

    if (estadoUsuarios[numero] === 'eligiendo_cantidad_sopas') {
        let cant = parseInt(texto);
        if (isNaN(cant) || cant <= 0) return msg.reply('Escriba un número válido.');
        datosPedido[numero].cantidadSopasTotal = cant;
        estadoUsuarios[numero] = 'eligiendo_sabor';
        return msg.reply(`Perfecto, son ${cant} sopas. Dígame el sabor de la primera:\n1️⃣ ${menuDiario.sopa1}\n2️⃣ ${menuDiario.sopa2}`);
    }

    if (estadoUsuarios[numero] === 'eligiendo_sabor') {
        if (texto === '1') datosPedido[numero].sopaActual = menuDiario.sopa1;
        else if (texto === '2') datosPedido[numero].sopaActual = menuDiario.sopa2;
        else return msg.reply('Elija 1 o 2 para el sabor.');

        estadoUsuarios[numero] = 'eligiendo_acompanamiento';
        return msg.reply(`¿Con qué acompañamiento quiere la sopa de ${datosPedido[numero].sopaActual}?\n1️⃣ Arroz\n2️⃣ Banano\n3️⃣ Porción de Aguacate`);
    }

    if (estadoUsuarios[numero] === 'eligiendo_acompanamiento') {
        let acomp = '';
        if (texto === '1') acomp = 'Arroz';
        else if (texto === '2') acomp = 'Banano';
        else if (texto === '3') acomp = 'Aguacate';
        else return msg.reply('Elija 1, 2 o 3.');

        datosPedido[numero].carrito.push({
            sopa: datosPedido[numero].sopaActual,
            acompanamiento: acomp
        });

        if (datosPedido[numero].carrito.length < datosPedido[numero].cantidadSopasTotal) {
            estadoUsuarios[numero] = 'eligiendo_sabor';
            let faltan = datosPedido[numero].cantidadSopasTotal - datosPedido[numero].carrito.length;
            return msg.reply(`¡Anotada! Siguiente sopa (faltan ${faltan}):\n1️⃣ ${menuDiario.sopa1}\n2️⃣ ${menuDiario.sopa2}`);
        } else {
            estadoUsuarios[numero] = 'eligiendo_extras';
            return msg.reply(`¡Listo! Ya tengo sus ${datosPedido[numero].cantidadSopasTotal} sopas. ¿Desea alguna porción *adicional* ($2.000 c/u)?\n1️⃣ Arroz extra\n2️⃣ Banano extra\n3️⃣ Aguacate extra\n4️⃣ Ninguno, seguir con el pedido`);
        }
    }

    if (estadoUsuarios[numero] === 'eligiendo_extras') {
        if (texto === '1') datosPedido[numero].extraPendiente = 'Arroz';
        else if (texto === '2') datosPedido[numero].extraPendiente = 'Banano';
        else if (texto === '3') datosPedido[numero].extraPendiente = 'Aguacate';
        else if (texto === '4') {
            estadoUsuarios[numero] = 'esperando_entrega';
            return msg.reply(`¿Cómo hacemos con la entrega?\n1️⃣ Paso a recogerla\n2️⃣ Domicilio (Solo alrededores)`);
        } else return msg.reply('Responda 1, 2, 3 o 4.');

        estadoUsuarios[numero] = 'esperando_cantidad_extra';
        return msg.reply(`¿Cuántas porciones de *${datosPedido[numero].extraPendiente} extra* desea agregar?`);
    }

    if (estadoUsuarios[numero] === 'esperando_cantidad_extra') {
        let cantExtra = parseInt(texto);
        if (isNaN(cantExtra) || cantExtra <= 0) return msg.reply('Escriba un número válido.');
        for (let i = 0; i < cantExtra; i++) {
            datosPedido[numero].adicionales.push(datosPedido[numero].extraPendiente);
        }
        estadoUsuarios[numero] = 'eligiendo_extras';
        return msg.reply(`${cantExtra} porción(es) de ${datosPedido[numero].extraPendiente} anotadas ✅. ¿Desea algo más?\n1️⃣ Arroz extra\n2️⃣ Banano extra\n3️⃣ Aguacate extra\n4️⃣ Ninguno más, continuar`);
    }

    if (estadoUsuarios[numero] === 'esperando_entrega') {
        if (texto === '1') datosPedido[numero].tipoEntrega = 'Punto de entrega';
        else if (texto === '2') datosPedido[numero].tipoEntrega = 'Domicilio';
        else return msg.reply('Responda 1 o 2.');

        estadoUsuarios[numero] = 'esperando_nombre';
        return msg.reply(`¡Listo el pollo! 🐔 ¿A qué nombre anotamos su pedido?`);
    }

    if (estadoUsuarios[numero] === 'esperando_nombre') {
        datosPedido[numero].nombre = msg.body; 
        if (datosPedido[numero].tipoEntrega === 'Domicilio') {
            estadoUsuarios[numero] = 'esperando_direccion';
            return msg.reply(`Anotado, ${datosPedido[numero].nombre}. ¿A qué dirección exacta y barrio se lo mandamos?`);
        } else return finalizarPedido(numero, msg);
    }

    if (estadoUsuarios[numero] === 'esperando_direccion') {
        datosPedido[numero].direccion = msg.body;
        return finalizarPedido(numero, msg);
    }

    async function finalizarPedido(userId, mensajeOriginal) {
        estadoUsuarios[userId] = 'finalizado';
        let total = (datosPedido[userId].cantidadSopasTotal * precioBase) + (datosPedido[userId].adicionales.length * 2000);
        let conteoExtras = {};
        datosPedido[userId].adicionales.forEach(x => conteoExtras[x] = (conteoExtras[x] || 0) + 1);
        let extrasTexto = Object.entries(conteoExtras).map(([nombre, cant]) => `${cant}x ${nombre}`).join(', ');
        let resumenSopas = '';
        datosPedido[userId].carrito.forEach((item, i) => {
            resumenSopas += `- Sopa ${i+1}: ${item.sopa} (con ${item.acompanamiento})\n`;
        });

        let recibo = `*¡PEDIDO CONFIRMADO, VECINO!* ✅\n\n👤 *Nombre:* ${datosPedido[userId].nombre}\n`;
        recibo += `📍 *Entrega:* ${datosPedido[userId].tipoEntrega}\n`;
        if (datosPedido[userId].tipoEntrega === 'Domicilio') recibo += `🏠 *Dirección:* ${datosPedido[userId].direccion}\n`;
        recibo += `\n*Su almuerzo:*\n${resumenSopas}`;
        if (datosPedido[userId].adicionales.length > 0) recibo += `*Extras:* ${extrasTexto}\n`;
        recibo += `\n💰 *TOTAL A PAGAR: $${total.toLocaleString('es-CO')}*`;
        recibo += `\n(Recibimos Efectivo, Nequi o Daviplata)\n\nEn breve confirmamos el tiempo. ¡Buen provecho! 🍲`;

        client.sendMessage(ID_GRUPO_COCINA, `🚨 *NUEVO PEDIDO Sopitas del Campo* 🚨\n\n` + recibo);
        return mensajeOriginal.reply(recibo);
    }
});

client.initialize();