// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// inicializa o Firebase Admin SDK
admin.initializeApp();

exports.novoRegistroNotificacao = functions.firestore
  .document("registros/{registroId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();

    const payload = {
      notification: {
        title: "Novo Registro",
        body: `Um novo registro foi adicionado por ${data.nomeAcs || "um agente"}.`,
      },
    };

    try {
      // envia notificação para todos os inscritos no tópico "allUsers"
      await admin.messaging().sendToTopic("allUsers", payload);
      console.log("Notificação enviada com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
    }
  });
