package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.Absence;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface AbsenceRepository extends JpaRepository<Absence, Long> {
    List<Absence> findByConsultantId(Long consultantId);

    // Utilisé par DashboardService pour vérifier si une absence VALIDÉE existe
    boolean existsByConsultantIdAndDateAndStatut(Long consultantId, LocalDate date, StatutPointage statut);
}