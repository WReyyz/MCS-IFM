-- ============================================
-- Migration 024: RPC function for manager approval / rejection of work orders
-- ============================================

CREATE OR REPLACE FUNCTION public.approve_work_order_by_manager(
    p_work_order_id UUID,
    p_approved BOOLEAN,
    p_comment TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
BEGIN
    -- Verify caller is a manager
    SELECT role INTO v_user_role FROM public.profiles WHERE id = v_user_id;
    IF v_user_role <> 'manager' THEN
        RAISE EXCEPTION 'Only users with role manager can approve work orders';
    END IF;

    -- Update work order status and manager fields
    UPDATE work_orders
    SET
        status = CASE WHEN p_approved THEN 'closed' ELSE 'rejected_to_inspector' END,
        manager_approved = p_approved,
        manager_approved_at = now(),
        manager_comment = p_comment
    WHERE id = p_work_order_id;

    -- Insert audit entry into existing approval_log table (assumed to exist)
    INSERT INTO approval_log (
        work_order_id,
        inspector_id,
        manager_id,
        status,
        comment,
        created_at
    ) VALUES (
        p_work_order_id,
        NULL, -- inspector_id is not affected at this stage (kept from prior inspection step)
        v_user_id,
        CASE WHEN p_approved THEN 'approved' ELSE 'rejected' END,
        p_comment,
        now()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users; role enforcement is done inside the function (SECURITY DEFINER)
GRANT EXECUTE ON FUNCTION public.approve_work_order_by_manager(UUID, BOOLEAN, TEXT) TO public;

-- ============================================
-- End Migration
-- ============================================
