package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.RapportActivite;
import ma.cdgcapital.consulttrack.model.StatutPointage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RapportActiviteRepository extends JpaRepository<RapportActivite, Long> {

    Optional<RapportActivite> findByConsultantIdAndAnneeAndMois(Long consultantId, int annee, int mois);

    List<RapportActivite> findByStatut(StatutPointage statut);
}
