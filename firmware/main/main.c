/* Esqueleto N4: ESP32-S3 habla REST/JSON con Nexora (RN-019).
 * No incluye sensores extra. STT/TTS/agente viven en el backend (mocks si no hay URL).
 */
#include <stdio.h>
#include <string.h>

#ifndef NEXORA_API_BASE
#define NEXORA_API_BASE "http://192.168.1.1:8000"
#endif

static const char *IDENTIFICADOR = "NEX-1";
static const char *CLAVE = ""; /* se carga en flash; no commitear secretos */

void nexora_autorizar(void)
{
    /* POST /api/v1/aparato/autorizar {identificador, clave} → Bearer */
    printf("autorizar %s en %s/api/v1/aparato/autorizar\n", IDENTIFICADOR, NEXORA_API_BASE);
}

void nexora_latido(void)
{
    printf("POST %s/api/v1/aparato/latido\n", NEXORA_API_BASE);
}

void nexora_comandos(void)
{
    printf("GET %s/api/v1/aparato/comandos y ack\n", NEXORA_API_BASE);
}

void nexora_voz(const char *texto)
{
    /* Cliente: armar solicitud. Proveedor: dictar informe. */
    printf("POST voz texto=%s\n", texto ? texto : "");
}

void app_main(void)
{
    nexora_autorizar();
    nexora_latido();
    nexora_comandos();
    nexora_voz("el equipo no enciende");
}
