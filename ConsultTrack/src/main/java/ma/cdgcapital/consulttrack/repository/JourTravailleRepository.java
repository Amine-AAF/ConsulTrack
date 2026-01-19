package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.JourTravaille;
import ma.cdgcapital.consulttrack.model.StatutSaisie;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface JourTravailleRepository extends JpaRepository<JourTravaille, Long> {

    // Trouver tous les jours saisis par un consultant
    List<JourTravaille> findByConsultantId(Long consultantId);

    // Trouver les jours d'un consultant pour un mois spécifique (utile pour le RPI)
    // On cherche les dates entre le début et la fin du mois
    List<JourTravaille> findByConsultantIdAndDateJourBetween(Long consultantId, LocalDate start, LocalDate end);

    // Trouver les jours par statut (ex: tous ceux qui sont 'SOUMIS' pour validation par l'admin)
    List<JourTravaille> findByStatut(StatutSaisie statut);
}