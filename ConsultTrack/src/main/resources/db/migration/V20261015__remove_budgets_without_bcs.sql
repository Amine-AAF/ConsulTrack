-- Remove the 2026 budget rows confirmed to have no BC, along with their DA rows.
-- Keep any budget if a BC has since been linked to its code.
BEGIN;

DELETE FROM demande_approvisionnement da
USING budget_annuel b
WHERE da.budget_id = b.id
  AND b.annee = 2026
  AND upper(trim(b.code_budget)) IN ('LG3000', 'PJ6063', 'PJ6056')
  AND NOT EXISTS (
      SELECT 1
      FROM bon_de_commande bc
      WHERE upper(trim(bc.code_budget)) = upper(trim(b.code_budget))
  );

DELETE FROM budget_annuel b
WHERE b.annee = 2026
  AND upper(trim(b.code_budget)) IN ('LG3000', 'PJ6063', 'PJ6056')
  AND NOT EXISTS (
      SELECT 1
      FROM bon_de_commande bc
      WHERE upper(trim(bc.code_budget)) = upper(trim(b.code_budget))
  );

COMMIT;
