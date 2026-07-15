package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.RPI;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface RpiRepository extends JpaRepository<RPI, Long> {

    @Query("SELECT r FROM RPI r WHERE r.consultant.cabinet.id = :cabinetId " +
            "AND r.mois = :mois AND r.annee = :annee")
    List<RPI> findByCabinetAndMonth(@Param("cabinetId") Long cabinetId,
                                    @Param("mois") int mois,
                                    @Param("annee") int annee);

    List<RPI> findByConsultantIdAndAnnee(Long consultantId, int annee);
}