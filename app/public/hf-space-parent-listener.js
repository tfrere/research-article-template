/**
 * Script pour la fenêtre parente des Spaces Hugging Face
 * Ce script écoute les messages de l'iframe et met à jour l'URL de la fenêtre parente
 * 
 * Instructions d'utilisation :
 * 1. Ajoutez ce script à votre Space Hugging Face dans le fichier app.py ou dans un composant Gradio
 * 2. Ou utilisez-le dans une page HTML qui contient votre iframe
 */

(function () {
    'use strict';

    console.log('HF Space Parent Listener initialized');

    // Écouter les messages de l'iframe
    window.addEventListener('message', function (event) {
        console.log('Received message from iframe:', event.data);

        // Vérifier le type de message
        if (event.data && event.data.type) {
            switch (event.data.type) {
                case 'urlChange':
                case 'anchorChange':
                case 'HF_SPACE_URL_UPDATE':
                    handleUrlChange(event.data);
                    break;
                default:
                    console.log('Unknown message type:', event.data.type);
            }
        }
    });

    function handleUrlChange(data) {
        try {
            const hash = data.hash || data.anchorId;
            const url = data.url;

            if (hash) {
                // Mettre à jour l'URL avec la nouvelle ancre
                const newUrl = new URL(window.location);
                newUrl.hash = hash;

                // Utiliser replaceState pour éviter d'ajouter une entrée dans l'historique
                window.history.replaceState(null, '', newUrl.toString());

                console.log('Updated parent URL to:', newUrl.toString());

                // Optionnel : faire défiler vers l'élément correspondant dans la page parente
                const targetElement = document.querySelector(hash);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        } catch (error) {
            console.error('Error updating parent URL:', error);
        }
    }

    // Fonction utilitaire pour tester la communication
    window.testIframeCommunication = function () {
        console.log('Testing iframe communication...');
        const iframe = document.querySelector('iframe');
        if (iframe) {
            iframe.contentWindow.postMessage({ type: 'test' }, '*');
        } else {
            console.log('No iframe found');
        }
    };

})();
