package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.TacheRealisee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TacheRealiseeRepository extends JpaRepository<TacheRealisee, Long> {

    // Utilisé pour la Séquentialité
    List<TacheRealisee> findByConsultantIdAndAnneeAndMois(Long consultantId, int annee, int mois);

    // Utilisé pour la Sauvegarde (Update vs Insert)
    Optional<TacheRealisee> findByConsultantIdAndDate(Long consultantId, LocalDate date);

    // Utilisé pour le Calcul des BC
    List<TacheRealisee> findByConsultantId(Long consultantId);
}