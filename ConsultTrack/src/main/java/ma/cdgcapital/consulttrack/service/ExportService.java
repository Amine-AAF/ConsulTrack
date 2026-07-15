package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.RpiMoisDTO;

public interface ExportService {
    byte[] exporterEnPdf(RpiMoisDTO donnees);
}