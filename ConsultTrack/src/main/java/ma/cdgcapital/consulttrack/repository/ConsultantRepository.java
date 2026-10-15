package ma.cdgcapital.consulttrack.repository;

import ma.cdgcapital.consulttrack.model.Consultant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ConsultantRepository extends JpaRepository<Consultant, Long> {

    Optional<Consultant> findByEmail(String email);
    java.util.List<Consultant> findByManager_Id(Long managerId);
}
