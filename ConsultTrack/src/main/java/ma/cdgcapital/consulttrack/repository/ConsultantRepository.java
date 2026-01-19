package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.Consultant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConsultantRepository extends JpaRepository<Consultant, Long> {
}