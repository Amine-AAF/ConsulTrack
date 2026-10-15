package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.BudgetAnnuel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface BudgetAnnuelRepository extends JpaRepository<BudgetAnnuel, Long> {
    List<BudgetAnnuel> findByAnneeOrderByCodeBudget(Integer annee);
    Optional<BudgetAnnuel> findByAnneeAndCodeBudget(Integer annee, String codeBudget);
}
