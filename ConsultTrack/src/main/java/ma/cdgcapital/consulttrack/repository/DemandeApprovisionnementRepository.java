package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.DemandeApprovisionnement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface DemandeApprovisionnementRepository extends JpaRepository<DemandeApprovisionnement, Long> {
    List<DemandeApprovisionnement> findByBudget_IdOrderByIdDesc(Long budgetId);
    Optional<DemandeApprovisionnement> findBySourceKey(String sourceKey);
}
