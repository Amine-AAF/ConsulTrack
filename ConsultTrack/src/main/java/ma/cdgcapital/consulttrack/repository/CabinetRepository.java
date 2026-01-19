package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.Cabinet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface CabinetRepository extends JpaRepository<Cabinet, Long> {
}