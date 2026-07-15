package ma.cdgcapital.consulttrack.controller;

import ma.cdgcapital.consulttrack.dto.auth.LoginRequest;
import ma.cdgcapital.consulttrack.dto.auth.LoginResponse;
import ma.cdgcapital.consulttrack.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}
