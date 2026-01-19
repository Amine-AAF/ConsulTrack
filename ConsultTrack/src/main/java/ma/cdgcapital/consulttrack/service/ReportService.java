package ma.cdgcapital.consulttrack.service;

import ma.cdgcapital.consulttrack.dto.RpiMoisDTO;
import ma.cdgcapital.consulttrack.model.BonDeCommande;
import ma.cdgcapital.consulttrack.model.JourTravaille;
import ma.cdgcapital.consulttrack.repository.JourTravailleRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.List;

@Service
public class ReportService {

    @Autowired
    private JourTravailleRepository jourRepository;

    public RpiMoisDTO genererDonneesRPI(Long consultantId, Long bcId, int annee, int mois) {
        RpiMoisDTO rpi = new RpiMoisDTO();

        YearMonth yearMonth = YearMonth.of(annee, mois);
        LocalDate start = yearMonth.atDay(1);
        LocalDate end = yearMonth.atEndOfMonth();

        List<JourTravaille> jours = jourRepository.findByConsultantIdAndDateJourBetween(consultantId, start, end);

        if (!jours.isEmpty()) {
            double totalDuMois = jours.stream().mapToDouble(JourTravaille::getDuree).sum();
            BonDeCommande bc = jours.get(0).getBonDeCommande();

            rpi.setReferenceBC(bc.getReference());
            rpi.setJhBudgetBC(bc.getJoursMax());
            rpi.setConsommeMois(totalDuMois);
            // Ici, vous pourriez calculer jhAvantMois en requêtant les jours avant 'start'
        }

        rpi.setMois(yearMonth.getMonth().name());
        rpi.setSemaines(new ArrayList<>());

        return rpi;
    }
}