package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.AffectationBC;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface AffectationRepository extends JpaRepository<AffectationBC, Long> {

    @Query("SELECT a.tjm FROM AffectationBC a " +
            "WHERE a.consultant.id = :consultantId " +
            "AND a.bc.id = :bcId")
    Double findTjmByConsultantAndBC(@Param("consultantId") Long consultantId,
                                    @Param("bcId") Long bcId);
}

