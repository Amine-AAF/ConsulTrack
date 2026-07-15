package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.StatutPointage;
import ma.cdgcapital.consulttrack.model.TacheRealisee;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface TacheRealiseeRepository extends JpaRepository<TacheRealisee, Long> {

    List<TacheRealisee> findByConsultantIdAndAnneeAndMois(Long consultantId, int annee, int mois);

    Optional<TacheRealisee> findByConsultantIdAndDate(Long consultantId, LocalDate date);

    List<TacheRealisee> findByConsultantId(Long consultantId);

    List<TacheRealisee> findByConsultantIdAndDateBetween(Long consultantId, LocalDate start, LocalDate end);

    List<TacheRealisee> findByStatut(StatutPointage statut);

    @Query("SELECT COALESCE(SUM(t.duree), 0) FROM TacheRealisee t " +
           "WHERE t.bonDeCommande.id = :bcId AND t.statut = :statut")
    Double sumDureeByBcAndStatut(@Param("bcId") Long bcId, @Param("statut") StatutPointage statut);

    @Query("SELECT COALESCE(SUM(t.duree), 0) FROM TacheRealisee t " +
           "WHERE t.bonDeCommande.id = :bcId AND t.statut IN :statuts")
    Double sumDureeByBcAndStatutIn(@Param("bcId") Long bcId,
                                   @Param("statuts") List<StatutPointage> statuts);

    @Query("SELECT t FROM TacheRealisee t " +
           "WHERE t.consultant.id = :consultantId " +
           "AND t.statut = :statut " +
           "AND t.annee = :annee AND t.mois = :mois")
    List<TacheRealisee> findByConsultantStatutAndPeriode(@Param("consultantId") Long consultantId,
                                                         @Param("statut") StatutPointage statut,
                                                         @Param("annee") int annee,
                                                         @Param("mois") int mois);

    @Query("SELECT t FROM TacheRealisee t " +
           "WHERE FUNCTION('YEAR', t.date) = :annee " +
           "AND (:mois IS NULL OR FUNCTION('MONTH', t.date) = :mois) " +
           "AND (:consultantId IS NULL OR t.consultant.id = :consultantId) " +
           "AND t.modeSaisie = 'BC' " +
           "ORDER BY t.date DESC")
    List<TacheRealisee> rechercherActivitesBC(@Param("annee") int annee,
                                              @Param("mois") Integer mois,
                                              @Param("consultantId") Long consultantId);
}
