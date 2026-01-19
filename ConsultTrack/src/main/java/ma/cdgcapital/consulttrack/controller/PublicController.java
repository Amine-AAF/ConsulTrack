package ma.cdgcapital.consulttrack.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicController {

    /**
     * Endpoint de test pour vérifier si l'API est en ligne sans sécurité.
     * Accessible via: http://localhost:8081/api/public/status
     */
    @GetMapping("/status")
    public Map<String, String> getStatus() {
        Map<String, String> status = new HashMap<>();
        status.put("status", "UP");
        status.put("message", "ConsultTrack API est opérationnelle");
        return status;
    }

    /**
     * Informations publiques sur les versions ou la maintenance
     */
    @GetMapping("/info")
    public String getInfo() {
        return "Système de suivi des consultants CDG Capital - v1.0.0";
    }
}