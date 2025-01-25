require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const Product = require('./models/Product');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Conexión a MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Conexión a MongoDB exitosa"))
    .catch((err) => console.error("Error al conectar a MongoDB:", err));

// Endpoint: Chat con ChatGPT
app.post('/chat', async (req, res) => {
    const { domain, userMessage } = req.body;

    if (!domain || !userMessage) {
        return res.status(400).json({ error: 'Faltan datos en la solicitud (domain y/o userMessage).' });
    }

    try {
        // Carga productos y genera una lista compacta
        const products = await Product.find({ domain });
        if (!products.length) {
            return res.status(404).json({ error: `No se encontraron productos para el dominio: ${domain}.` });
        }

        // Filtra y organiza solo datos clave de los productos
        const productDescriptions = products.map((product) => {
            return `
<li>
    <a href="https://${domain}/product/${product.slug}" class="text-blue-600 underline">${product.title}</a>
    <p class="text-sm">${product.description_short}</p>
    <img src="${product.image_default}" alt="${product.title}" class="w-24 h-24">
    <p class="text-sm">Precio: $${product.price?.sale || product.price?.regular || 'N/A'}</p>
</li>`;
        }).join("");

        // Define un mensaje de sistema optimizado
        const systemMessage = `
Eres un asistente de ventas para la tienda "${domain}". Los productos disponibles están organizados en esta lista HTML en list-decimal brinda todo el html del producto o los productos consultados:
<ol class="list-decimal ml-4">${productDescriptions}</ol>
Responde preguntas específicas sobre los productos en un formato breve. Si te preguntan por algún producto, incluye el enlace y la imagen correspondiente. Sé claro y respetuoso al responder a cualquier mensaje ofensivo.
   Los links encieralos en un boton para hacer click <a> y las imagenes en <img>`;

        // Solicitud a la API de OpenAI
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: "gpt-3.5-turbo",
                messages: [
                    { role: "system", content: systemMessage },
                    { role: "user", content: userMessage },
                ],
                max_tokens: 300,
                temperature: 1,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        const assistantMessage = response.data.choices[0].message.content.trim();
        res.json({ assistantMessage });
    } catch (error) {
        console.error('Error con OpenAI:', error.response?.data || error.message);
        res.status(500).json({ error: 'Error al interactuar con el modelo de OpenAI.' });
    }
});

// Servidor en escucha
app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
});
