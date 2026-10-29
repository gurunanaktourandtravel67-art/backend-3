package com.rastaa.fare;

import com.rastaa.fare.model.FareRequest;
import com.rastaa.fare.model.FareResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/fare")
@CrossOrigin(origins = "*") // called server-to-server by Node, not from the browser —
                            // in production this should sit on a private network,
                            // not be reachable from the public internet at all.
public class FareController {

    private final FareService fareService;

    public FareController(FareService fareService) {
        this.fareService = fareService;
    }

    @PostMapping("/calculate")
    public ResponseEntity<FareResponse> calculate(@Valid @RequestBody FareRequest request) {
        return ResponseEntity.ok(fareService.calculate(request));
    }

    @GetMapping("/health")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("fare-engine ok");
    }
}
